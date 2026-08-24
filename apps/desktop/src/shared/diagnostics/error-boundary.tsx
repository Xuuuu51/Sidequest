import { Warning } from "@phosphor-icons/react";
import { Component, type ReactNode } from "react";

import type { ApplicationKind } from "../../app-entry";
import { useMainWindowStore } from "../../store/main-window";
import { useQuickCaptureStore } from "../../store/quick-capture";
import {
  getDiagnosticReport,
  revealDiagnosticLogs,
  writeClipboardText,
} from "../tauri/commands";
import { logFrontendError } from "./logger";
import { i18n } from "../i18n/i18n";

interface ErrorBoundaryProps {
  applicationKind: ApplicationKind;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  feedback: string | null;
}

export class ApplicationErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false, feedback: null };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    logFrontendError(
      `React render failed window=${this.props.applicationKind}`,
      error,
    );
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    const draft = currentDraft(this.props.applicationKind);
    return (
      <main
        className={`fatal-boundary fatal-boundary-${this.props.applicationKind}`}
      >
        <Warning aria-hidden="true" size={22} />
        <h1>{i18n.t("fatal.title", { ns: "errors" })}</h1>
        <p>{i18n.t("fatal.description", { ns: "errors" })}</p>
        {draft !== null && (
          <p className="fatal-draft-warning" role="alert">
            {i18n.t("fatal.draftWarning", { ns: "errors" })}
          </p>
        )}
        <div className="fatal-boundary-actions">
          {draft !== null && (
            <button onClick={() => void this.copyDraft(draft)} type="button">
              {i18n.t("fatal.copyDraft", { ns: "errors" })}
            </button>
          )}
          <button onClick={() => void this.copyDiagnostics()} type="button">
            {i18n.t("fatal.copyDiagnostics", { ns: "errors" })}
          </button>
          <button onClick={() => void this.revealLogs()} type="button">
            {i18n.t("fatal.revealLogs", { ns: "errors" })}
          </button>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            {i18n.t("fatal.reload", { ns: "errors" })}
          </button>
        </div>
        {this.state.feedback !== null && (
          <p className="fatal-boundary-feedback" role="status">
            {this.state.feedback}
          </p>
        )}
      </main>
    );
  }

  private async copyDraft(draft: string): Promise<void> {
    try {
      await this.writeText(draft);
      this.setState({
        feedback: i18n.t("fatal.draftCopied", { ns: "errors" }),
      });
    } catch (cause) {
      logFrontendError("copy fatal draft failed", cause);
      this.setState({
        feedback: i18n.t("fatal.draftCopyFailed", { ns: "errors" }),
      });
    }
  }

  private async copyDiagnostics(): Promise<void> {
    try {
      const diagnostics = await getDiagnosticReport();
      await this.writeText(diagnostics.report);
      this.setState({
        feedback: i18n.t("fatal.diagnosticsCopied", { ns: "errors" }),
      });
    } catch (cause) {
      logFrontendError("copy diagnostics failed", cause);
      this.setState({
        feedback: i18n.t("fatal.diagnosticsCopyFailed", { ns: "errors" }),
      });
    }
  }

  private async revealLogs(): Promise<void> {
    try {
      await revealDiagnosticLogs();
      this.setState({
        feedback: i18n.t("fatal.logsRevealed", { ns: "errors" }),
      });
    } catch (cause) {
      logFrontendError("reveal diagnostics failed", cause);
      this.setState({
        feedback: i18n.t("fatal.logsRevealFailed", { ns: "errors" }),
      });
    }
  }

  private writeText(value: string): Promise<void> {
    if (this.props.applicationKind === "quickCapture") {
      if (typeof navigator.clipboard?.writeText !== "function") {
        return Promise.reject(new Error("Browser clipboard is unavailable"));
      }
      return navigator.clipboard.writeText(value);
    }
    return writeClipboardText(value);
  }
}

function currentDraft(applicationKind: ApplicationKind): string | null {
  if (applicationKind === "quickCapture") {
    const draft = useQuickCaptureStore.getState().draft;
    return draft.length > 0 ? draft : null;
  }
  const editor = useMainWindowStore.getState().editor;
  if (editor === null || editor.draftContent === editor.baseContent) {
    return null;
  }
  return editor.draftContent;
}
