import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDesktopQueryClient } from "../../shared/query/client";
import type { AppStateDto } from "../../shared/tauri/types";
import { useQuickCaptureStore } from "../../store/quick-capture";
import { QuickCaptureApp } from "./quick-capture-app";

const mocks = vi.hoisted(() => ({
  getAppState: vi.fn(),
  addProject: vi.fn(),
  captureQuest: vi.fn(),
  hideQuickCapture: vi.fn(),
  saveQuickCapturePosition: vi.fn(),
  selectProjectDirectory: vi.fn(),
  listenForQuickCaptureShown: vi.fn(),
  listenForAppStateInvalidation: vi.fn(),
  listenForCurrentWindowClose: vi.fn(),
  listenForCurrentWindowMove: vi.fn(),
}));

vi.mock("../../shared/tauri/commands", () => mocks);
vi.mock("../../shared/tauri/events", () => ({
  listenForQuickCaptureShown: mocks.listenForQuickCaptureShown,
  listenForAppStateInvalidation: mocks.listenForAppStateInvalidation,
}));
vi.mock("../../shared/tauri/window", () => ({
  listenForCurrentWindowClose: mocks.listenForCurrentWindowClose,
  listenForCurrentWindowMove: mocks.listenForCurrentWindowMove,
}));

const appState: AppStateDto = {
  projects: [
    { path: "/active", name: "Active", state: "writable" },
    { path: "/readonly", name: "Readonly", state: "readOnly" },
  ],
  lastSelectedProject: "/active",
  panelPreferences: {
    sidebarWidth: 224,
    sidebarCollapsed: false,
    drawerWidth: 480,
  },
  quickCapture: { lastProjectPath: "/active", position: null },
  onboardingStep: "complete",
  recoveryWarning: null,
};

describe("QuickCaptureApp", () => {
  beforeEach(() => {
    useQuickCaptureStore.setState({
      draft: "",
      selectedProjectPath: null,
      phase: "idle",
      error: null,
    });
    mocks.getAppState.mockReset().mockResolvedValue(appState);
    mocks.addProject.mockReset().mockResolvedValue(appState);
    mocks.captureQuest.mockReset().mockResolvedValue({
      quest: {
        id: "sq_01KTEST",
        createdAt: "2026-08-23T10:00:00+08:00",
        content: "Captured",
        status: "inbox",
      },
      preferenceWarning: null,
    });
    mocks.hideQuickCapture.mockReset().mockResolvedValue(undefined);
    mocks.saveQuickCapturePosition.mockReset().mockResolvedValue(undefined);
    mocks.selectProjectDirectory.mockReset().mockResolvedValue(null);
    for (const listener of [
      mocks.listenForQuickCaptureShown,
      mocks.listenForAppStateInvalidation,
      mocks.listenForCurrentWindowClose,
      mocks.listenForCurrentWindowMove,
    ]) {
      listener.mockReset().mockResolvedValue(() => undefined);
    }
  });

  it("uses_the_remembered_project_and_captures_with_command_enter", async () => {
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });

    fireEvent.change(editor, { target: { value: "Captured" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(mocks.captureQuest).not.toHaveBeenCalled();

    fireEvent.keyDown(editor, { key: "Enter", metaKey: true });
    await waitFor(() =>
      expect(mocks.captureQuest).toHaveBeenCalledWith("/active", "Captured"),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    await waitFor(() => expect(mocks.hideQuickCapture).toHaveBeenCalled(), {
      timeout: 1_000,
    });
  });

  it("retains_the_draft_after_failure_and_retries", async () => {
    mocks.captureQuest
      .mockRejectedValueOnce(new Error("Disk is busy"))
      .mockResolvedValueOnce({
        quest: {
          id: "sq_01KRETRY",
          createdAt: "2026-08-23T10:00:00+08:00",
          content: "Keep me",
          status: "inbox",
        },
        preferenceWarning: null,
      });
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });
    fireEvent.change(editor, { target: { value: "Keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    expect(await screen.findByText("Disk is busy")).toBeInTheDocument();
    expect(editor).toHaveValue("Keep me");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(mocks.captureQuest).toHaveBeenCalledTimes(2));
  });

  it("disables_capture_for_a_read_only_project", async () => {
    renderQuickCapture();
    const selector = await screen.findByRole("combobox", { name: "Project" });
    await waitFor(() => expect(selector).toHaveValue("/active"));
    fireEvent.change(selector, { target: { value: "/readonly" } });

    expect(
      await screen.findByText("This project is read-only"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture" })).toBeDisabled();
  });

  it("discards_the_draft_on_escape", async () => {
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });
    fireEvent.change(editor, { target: { value: "Discard me" } });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useQuickCaptureStore.getState().draft).toBe("");
    expect(mocks.hideQuickCapture).toHaveBeenCalled();
  });
});

function renderQuickCapture() {
  const queryClient = createDesktopQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <QuickCaptureApp />
    </QueryClientProvider>,
  );
}
