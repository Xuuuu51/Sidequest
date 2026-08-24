import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDesktopQueryClient } from "../../shared/query/client";
import type { IntegrationItemDto, SettingsDto } from "../../shared/tauri/types";
import { useMainWindowStore } from "../../store/main-window";
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
}));

vi.mock("../../shared/tauri/commands", () => mocks);

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
    useMainWindowStore.setState({
      shortcutRecording: false,
      licenseOpen: false,
    });
    mocks.getSettings.mockReset().mockResolvedValue(settings);
    mocks.getLocaleSettings.mockReset().mockResolvedValue({
      preference: "system",
      effectiveLocale: "en",
    });
    mocks.setLocalePreference.mockReset().mockResolvedValue({
      preference: "zh-CN",
      effectiveLocale: "zh-CN",
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

  it("shows_compact_integration_status_and_runs_install", async () => {
    renderSettings();

    expect(
      (await screen.findAllByText("Needs Attention")).length,
    ).toBeGreaterThan(0);
    const installButtons = screen.getAllByRole("button", { name: "Install" });
    fireEvent.click(installButtons[0]);

    await waitFor(() =>
      expect(mocks.installAgentSkill).toHaveBeenCalledWith("codex"),
    );
  });

  it("copies_diagnostics_and_reveals_logs_from_about", async () => {
    renderSettings();
    await screen.findByText("Diagnostics");

    fireEvent.click(screen.getByRole("button", { name: "Copy Diagnostics" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Logs" }));

    await waitFor(() =>
      expect(mocks.copyDiagnosticReport).toHaveBeenCalledTimes(1),
    );
    expect(mocks.revealDiagnosticLogs).toHaveBeenCalledTimes(1);
  });

  it("disables_launch_at_login_in_an_isolated_profile", async () => {
    mocks.getSettings.mockResolvedValue({
      ...settings,
      debugProfile: true,
      launchAtLoginAvailable: false,
    });

    renderSettings();
    await screen.findByText("Version 0.1.0");

    expect(screen.getByRole("checkbox")).toBeDisabled();
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
