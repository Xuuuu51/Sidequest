import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useMainWindowStore } from "../../store/main-window/store";
import { useQuickCaptureStore } from "../../store/quick-capture";
import { ApplicationErrorBoundary } from "./error-boundary";

const mocks = vi.hoisted(() => ({
  getDiagnosticReport: vi.fn(),
  revealDiagnosticLogs: vi.fn(),
  writeClipboardText: vi.fn(),
  browserWriteText: vi.fn(),
  logFrontendError: vi.fn(),
}));

vi.mock("../tauri/commands", () => ({
  getDiagnosticReport: mocks.getDiagnosticReport,
  revealDiagnosticLogs: mocks.revealDiagnosticLogs,
  writeClipboardText: mocks.writeClipboardText,
}));

vi.mock("./logger", () => ({
  logFrontendError: mocks.logFrontendError,
}));

function BrokenView(): never {
  throw new Error("render failed");
}

beforeEach(() => {
  mocks.getDiagnosticReport.mockReset().mockResolvedValue({
    generatedAt: "2026-08-24T00:00:00Z",
    report: "Safe diagnostics",
  });
  mocks.revealDiagnosticLogs.mockReset().mockResolvedValue(undefined);
  mocks.writeClipboardText.mockReset().mockResolvedValue(undefined);
  mocks.browserWriteText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.browserWriteText },
  });
  mocks.logFrontendError.mockReset();
  useMainWindowStore.getState().clearEditor();
  useQuickCaptureStore.getState().clearDraft();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

it("offers_to_copy_an_unsaved_main_window_draft_after_a_render_failure", async () => {
  useMainWindowStore
    .getState()
    .initializeEditor(
      "/project",
      "sq_quest",
      "Disk content",
      "2026-08-24T00:00:00Z",
      "inbox",
    );
  useMainWindowStore.getState().changeDraft("Unsaved content");

  render(
    <ApplicationErrorBoundary
      applicationKind="main"
      getDraft={() => "Unsaved content"}
      writeText={mocks.writeClipboardText}
    >
      <BrokenView />
    </ApplicationErrorBoundary>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy Unsaved Draft" }));

  await waitFor(() =>
    expect(mocks.writeClipboardText).toHaveBeenCalledWith("Unsaved content"),
  );
});

it("copies_diagnostics_without_exposing_a_draft_when_none_exists", async () => {
  render(
    <ApplicationErrorBoundary
      applicationKind="main"
      getDraft={() => null}
      writeText={mocks.writeClipboardText}
    >
      <BrokenView />
    </ApplicationErrorBoundary>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy Diagnostics" }));

  await waitFor(() =>
    expect(mocks.writeClipboardText).toHaveBeenCalledWith("Safe diagnostics"),
  );
  expect(
    screen.queryByRole("button", { name: "Copy Unsaved Draft" }),
  ).not.toBeInTheDocument();
});

it("uses_the_webview_clipboard_for_a_quick_capture_draft", async () => {
  useQuickCaptureStore.getState().setDraft("Quick unsaved content");

  render(
    <ApplicationErrorBoundary
      applicationKind="quickCapture"
      getDraft={() => "Quick unsaved content"}
      writeText={mocks.browserWriteText}
    >
      <BrokenView />
    </ApplicationErrorBoundary>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy Unsaved Draft" }));

  await waitFor(() =>
    expect(mocks.browserWriteText).toHaveBeenCalledWith(
      "Quick unsaved content",
    ),
  );
  expect(mocks.writeClipboardText).not.toHaveBeenCalled();
});
