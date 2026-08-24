import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDesktopQueryClient } from "../../shared/query/client";
import type { IntegrationItemDto, SettingsDto } from "../../shared/tauri/types";
import { useMainWindowStore } from "../../store/main-window/store";
import { SettingsPage } from "./settings-page";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getIntegrationStatus: vi.fn(),
  setGlobalShortcut: vi.fn(),
  setLaunchAtLogin: vi.fn(),
  installCli: vi.fn(),
  uninstallCli: vi.fn(),
  installAgentSkill: vi.fn(),
  uninstallAgentSkill: vi.fn(),
  copyDiagnosticReport: vi.fn(),
  revealDiagnosticLogs: vi.fn(),
  revealPath: vi.fn(),
  getLocaleSettings: vi.fn(),
  setLocalePreference: vi.fn(),
  getThemeSettings: vi.fn(),
  setThemePreference: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../shared/tauri/commands", () => mocks);
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const settings: SettingsDto = {
  shortcut: {
    modifiers: ["command", "shift"],
    key: "Space",
    display: "⌘⇧Space",
  },
  shortcutRegistration: "active",
  launchAtLogin: false,
  launchAtLoginAvailable: true,
  debugProfile: false,
  appVersion: "0.1.0",
  licenseText: "MIT License",
};

const integrations: IntegrationItemDto[] = [
  {
    id: "cli",
    state: "installed",
    path: "/home/.local/bin/sq",
    installedVersion: "0.1.0",
    bundledVersion: "0.1.0",
    message: null,
  },
  {
    id: "codex",
    state: "notInstalled",
    path: "/home/.codex/skills/sidequest/SKILL.md",
    installedVersion: null,
    bundledVersion: "0.1.0",
    message: null,
  },
  {
    id: "claude",
    state: "repairRequired",
    path: "/home/.claude/skills/sidequest/SKILL.md",
    installedVersion: "0.1.0",
    bundledVersion: "0.1.0",
    message: "Managed item was modified",
  },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    useMainWindowStore.setState({});
    mocks.getSettings.mockReset().mockResolvedValue(settings);
    mocks.getLocaleSettings.mockReset().mockResolvedValue({
      preference: "system",
      effectiveLocale: "en",
    });
    mocks.setLocalePreference.mockReset().mockResolvedValue({
      preference: "zh-CN",
      effectiveLocale: "zh-CN",
    });
    mocks.getThemeSettings.mockReset().mockResolvedValue({
      preference: "system",
    });
    mocks.setThemePreference.mockReset().mockResolvedValue({
      preference: "dark",
    });
    mocks.getIntegrationStatus.mockReset().mockResolvedValue(integrations);
    mocks.setGlobalShortcut
      .mockReset()
      .mockImplementation(async (shortcut) => ({
        ...settings,
        shortcut: { ...shortcut, display: "⌘⇧K" },
      }));
    mocks.setLaunchAtLogin
      .mockReset()
      .mockResolvedValue({ ...settings, launchAtLogin: true });
    mocks.installAgentSkill.mockReset().mockResolvedValue(integrations);
    mocks.uninstallAgentSkill.mockReset().mockResolvedValue(integrations);
    mocks.installCli.mockReset().mockResolvedValue(integrations);
    mocks.uninstallCli.mockReset().mockResolvedValue(integrations);
    mocks.copyDiagnosticReport.mockReset().mockResolvedValue({
      generatedAt: "2026-08-24T00:00:00Z",
      report: "Sidequest Diagnostics",
    });
    mocks.revealDiagnosticLogs.mockReset().mockResolvedValue(undefined);
    mocks.revealPath.mockReset().mockResolvedValue(undefined);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("places_back_navigation_below_the_window_controls_and_labels_the_menu", async () => {
    renderSettings();

    expect(await screen.findByRole("button", { name: "Back" })).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: "Settings", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("records_a_supported_shortcut_and_keeps_backend_validation_authoritative", async () => {
    renderSettings();
    const recorder = await screen.findByRole("button", { name: "⌘⇧Space" });

    fireEvent.click(recorder);
    fireEvent.keyDown(recorder, { key: "k", metaKey: true, shiftKey: true });

    await waitFor(() =>
      expect(mocks.setGlobalShortcut).toHaveBeenCalledWith({
        modifiers: ["command", "shift"],
        key: "k",
        display: "",
      }),
    );
  });

  it("persists_a_manual_language_preference", async () => {
    renderSettings();
    const language = await screen.findByRole("combobox", { name: "Language" });

    fireEvent.change(language, { target: { value: "zh-CN" } });

    await waitFor(() =>
      expect(mocks.setLocalePreference).toHaveBeenCalledWith("zh-CN"),
    );
  });

  it("persists_an_appearance_preference", async () => {
    renderSettings();
    const dark = await screen.findByRole("radio", { name: "Dark" });

    await waitFor(() => expect(dark).toBeEnabled());
    fireEvent.click(dark);

    await waitFor(() =>
      expect(mocks.setThemePreference).toHaveBeenCalledWith("dark"),
    );
  });

  it("shows_compact_integration_status_and_runs_install", async () => {
    renderSettings();
    fireEvent.click(
      await screen.findByRole("button", { name: "Integrations" }),
    );

    expect(screen.getAllByText("Needs Attention").length).toBeGreaterThan(0);
    const installButtons = screen.getAllByRole("button", { name: "Install" });
    fireEvent.click(installButtons[0]);

    await waitFor(() =>
      expect(mocks.installAgentSkill).toHaveBeenCalledWith("codex"),
    );
  });

  it("copies_diagnostics_and_reveals_logs_from_about", async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "About" }));
    await screen.findByText("Diagnostics");

    fireEvent.click(screen.getByRole("button", { name: "Copy Diagnostics" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Logs" }));

    await waitFor(() =>
      expect(mocks.copyDiagnosticReport).toHaveBeenCalledTimes(1),
    );
    expect(mocks.revealDiagnosticLogs).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
  });

  it("cancels_shortcut_recording_when_the_category_changes", async () => {
    renderSettings();
    const recorder = await screen.findByRole("button", { name: "⌘⇧Space" });

    fireEvent.click(recorder);
    expect(recorder).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Integrations" }));
    fireEvent.click(screen.getByRole("button", { name: "General" }));

    expect(screen.getByRole("button", { name: "⌘⇧Space" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("disables_launch_at_login_in_an_isolated_profile", async () => {
    mocks.getSettings.mockResolvedValue({
      ...settings,
      debugProfile: true,
      launchAtLoginAvailable: false,
    });

    renderSettings();
    await screen.findByText(
      "Unavailable while using an isolated debug profile.",
    );

    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Unavailable while using an isolated debug profile."),
    ).toBeInTheDocument();
  });
});

function renderSettings(): void {
  render(
    <QueryClientProvider client={createDesktopQueryClient()}>
      <SettingsPage onBack={() => undefined} />
    </QueryClientProvider>,
  );
}
