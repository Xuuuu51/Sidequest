import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDesktopQueryClient } from "../../shared/query/client";
import type {
  AppStateDto,
  QuickCaptureResultDto,
} from "../../shared/tauri/types";
import { useQuickCaptureStore } from "../../store/quick-capture";
import { QuickCaptureApp } from "./quick-capture-app";
import { i18n } from "../../shared/i18n/i18n";

const mocks = vi.hoisted(() => ({
  getAppState: vi.fn(),
  addProject: vi.fn(),
  captureQuest: vi.fn(),
  focusQuickCapture: vi.fn(),
  hideQuickCapture: vi.fn(),
  saveQuickCapturePosition: vi.fn(),
  selectProjectDirectory: vi.fn(),
  listenForQuickCaptureCloseRequest: vi.fn(),
  listenForQuickCaptureShown: vi.fn(),
  listenForAppStateInvalidation: vi.fn(),
  listenForDebugReloadRequest: vi.fn(),
  listenForCurrentWindowClose: vi.fn(),
  listenForCurrentWindowMove: vi.fn(),
  setCurrentWindowTitle: vi.fn(),
  shortcutCloseHandler: null as (() => void) | null,
  appStateInvalidatedHandler: null as (() => void) | null,
  debugReloadHandler: null as (() => void) | null,
}));

vi.mock("../../shared/tauri/commands", () => mocks);
vi.mock("../../shared/tauri/events", () => ({
  listenForQuickCaptureCloseRequest: mocks.listenForQuickCaptureCloseRequest,
  listenForQuickCaptureShown: mocks.listenForQuickCaptureShown,
  listenForAppStateInvalidation: mocks.listenForAppStateInvalidation,
  listenForDebugReloadRequest: mocks.listenForDebugReloadRequest,
}));
vi.mock("../../shared/tauri/window", () => ({
  listenForCurrentWindowClose: mocks.listenForCurrentWindowClose,
  listenForCurrentWindowMove: mocks.listenForCurrentWindowMove,
  setCurrentWindowTitle: mocks.setCurrentWindowTitle,
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
  beforeEach(async () => {
    await i18n.changeLanguage("en");
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
    mocks.focusQuickCapture.mockReset().mockResolvedValue(undefined);
    mocks.hideQuickCapture.mockReset().mockResolvedValue(undefined);
    mocks.saveQuickCapturePosition.mockReset().mockResolvedValue(undefined);
    mocks.setCurrentWindowTitle.mockReset().mockResolvedValue(undefined);
    mocks.selectProjectDirectory.mockReset().mockResolvedValue(null);
    for (const listener of [
      mocks.listenForQuickCaptureCloseRequest,
      mocks.listenForQuickCaptureShown,
      mocks.listenForAppStateInvalidation,
      mocks.listenForDebugReloadRequest,
      mocks.listenForCurrentWindowClose,
      mocks.listenForCurrentWindowMove,
    ]) {
      listener.mockReset().mockResolvedValue(() => undefined);
    }
    mocks.shortcutCloseHandler = null;
    mocks.listenForQuickCaptureCloseRequest.mockImplementation(
      async (handler) => {
        mocks.shortcutCloseHandler = handler;
        return () => undefined;
      },
    );
    mocks.appStateInvalidatedHandler = null;
    mocks.listenForAppStateInvalidation.mockImplementation(async (handler) => {
      mocks.appStateInvalidatedHandler = handler;
      return () => undefined;
    });
    mocks.debugReloadHandler = null;
    mocks.listenForDebugReloadRequest.mockImplementation(async (handler) => {
      mocks.debugReloadHandler = handler;
      return () => undefined;
    });
  });

  it("renders_the_capture_flow_in_simplified_chinese", async () => {
    await i18n.changeLanguage("zh-CN");
    renderQuickCapture();

    expect(
      await screen.findByRole("textbox", { name: "内容" }),
    ).toHaveAttribute("placeholder", "有什么需要之后处理？");
    expect(screen.getByRole("button", { name: "提交" })).toBeInTheDocument();
    expect(screen.getByText("⌘")).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("rounded-2xl");
    expect(screen.getByRole("main")).not.toHaveClass("border");
    const heading = screen.getByRole("heading", { name: "快速记录" });
    expect(heading).toHaveAttribute("data-tauri-drag-region");
    expect(heading.closest("header")).not.toHaveClass("border-b");
    expect(
      screen.getByRole("button", { name: "提交" }).closest("footer"),
    ).not.toHaveClass("border-t");
    expect(document.title).toBe("快速记录");
    expect(mocks.setCurrentWindowTitle).toHaveBeenCalledWith("快速记录");
  });

  it("blocks_debug_reload_while_a_draft_is_present", async () => {
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });
    fireEvent.change(editor, { target: { value: "Keep this draft" } });

    mocks.debugReloadHandler?.();

    expect(
      await screen.findByText(
        "Capture or close this draft before reloading Quick Capture.",
      ),
    ).toBeInTheDocument();
  });

  it("focuses_the_panel_and_editor_when_the_pointer_enters", async () => {
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });

    fireEvent.pointerEnter(screen.getByRole("main"));

    await waitFor(() => expect(mocks.focusQuickCapture).toHaveBeenCalled());
    await waitFor(() => expect(editor).toHaveFocus());
  });

  it("discards_and_hides_when_the_global_shortcut_requests_close", async () => {
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });
    fireEvent.change(editor, { target: { value: "Discard by shortcut" } });
    await waitFor(() => expect(mocks.shortcutCloseHandler).not.toBeNull());

    mocks.shortcutCloseHandler?.();

    expect(useQuickCaptureStore.getState().draft).toBe("");
    expect(mocks.hideQuickCapture).toHaveBeenCalled();
  });

  it("uses_the_remembered_project_and_captures_with_command_enter", async () => {
    let resolveCapture!: (value: QuickCaptureResultDto) => void;
    mocks.captureQuest.mockImplementationOnce(
      () =>
        new Promise<QuickCaptureResultDto>((resolve) => {
          resolveCapture = resolve;
        }),
    );
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
    resolveCapture({
      quest: {
        id: "sq_01KTEST",
        createdAt: "2026-08-23T10:00:00+08:00",
        content: "Captured",
        status: "inbox",
      },
      preferenceWarning: null,
    });
    expect(await screen.findByText("Submitted")).toBeInTheDocument();
    await waitFor(() => expect(mocks.hideQuickCapture).toHaveBeenCalled(), {
      timeout: 1_000,
    });
  });

  it("follows_the_project_selected_in_the_main_window", async () => {
    renderQuickCapture();
    expect(await screen.findByText("Active")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.appStateInvalidatedHandler).not.toBeNull(),
    );
    mocks.getAppState.mockResolvedValue({
      ...appState,
      lastSelectedProject: "/readonly",
      quickCapture: { ...appState.quickCapture, lastProjectPath: "/readonly" },
    });

    mocks.appStateInvalidatedHandler?.();

    expect(await screen.findByText("Readonly")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Submit failed")).toBeInTheDocument();
    expect(editor).toHaveValue("Keep me");
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(mocks.captureQuest).toHaveBeenCalledTimes(2));
  });

  it("disables_capture_for_a_read_only_project", async () => {
    renderQuickCapture();
    const selector = await screen.findByRole("combobox", { name: "Project" });
    await waitFor(() => expect(selector).toHaveTextContent("Active"));
    fireEvent.click(selector);
    fireEvent.click(
      screen.getByRole("option", { name: "Readonly — Read only" }),
    );

    expect(selector.getAttribute("title")).toContain(
      "This project is read-only",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Quest content" }),
    ).toBeEnabled();
  });

  it("closes_the_project_menu_before_discarding_the_window", async () => {
    renderQuickCapture();
    const selector = await screen.findByRole("combobox", { name: "Project" });
    await waitFor(() => expect(selector).toHaveTextContent("Active"));
    fireEvent.click(selector);
    expect(
      screen.getByRole("listbox", { name: "Project" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("listbox", { name: "Project" }),
    ).not.toBeInTheDocument();
    expect(mocks.hideQuickCapture).not.toHaveBeenCalled();
  });

  it("clears_a_previous_save_error_when_the_draft_changes", async () => {
    mocks.captureQuest.mockRejectedValueOnce(new Error("Disk is busy"));
    renderQuickCapture();
    const editor = await screen.findByRole("textbox", {
      name: "Quest content",
    });
    fireEvent.change(editor, { target: { value: "First attempt" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Submit failed")).toBeInTheDocument();

    fireEvent.change(editor, { target: { value: "Updated attempt" } });

    expect(screen.queryByText("Submit failed")).not.toBeInTheDocument();
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
