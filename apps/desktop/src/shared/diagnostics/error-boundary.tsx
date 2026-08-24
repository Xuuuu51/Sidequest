import { TriangleAlert } from "lucide-react";
import { Component, type ReactNode } from "react";

import type { ApplicationKind } from "../../app-entry";
import { getDiagnosticReport, revealDiagnosticLogs } from "../tauri/commands";
import { logFrontendError } from "./logger";
import { i18n } from "../i18n/i18n";
import { Button } from "../ui/button";

interface ErrorBoundaryProps {
  applicationKind: ApplicationKind;
  children: ReactNode;
  getDraft: () => string | null;
  writeText: (value: string) => Promise<void>;
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
    const draft = this.props.getDraft();
    return (
      <main
        className={`flex h-full w-full flex-col items-start justify-center gap-2.5 bg-background text-muted-foreground ${this.props.applicationKind === "quickCapture" ? "p-6" : "p-8"}`}
      >
        <TriangleAlert aria-hidden="true" size={22} />
        <h1 className="max-w-xl text-base font-semibold leading-[22px] text-foreground">
          {i18n.t("fatal.title", { ns: "errors" })}
        </h1>
        <p className="max-w-xl text-xs leading-[18px]">
          {i18n.t("fatal.description", { ns: "errors" })}
        </p>
        {draft !== null && (
          <p
            className="max-w-xl text-xs leading-[18px] text-warning"
            role="alert"
          >
            {i18n.t("fatal.draftWarning", { ns: "errors" })}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {draft !== null && (
            <Button
              onClick={() => void this.copyDraft(draft)}
              variant="outline"
            >
              {i18n.t("fatal.copyDraft", { ns: "errors" })}
            </Button>
          )}
          <Button onClick={() => void this.copyDiagnostics()} variant="outline">
            {i18n.t("fatal.copyDiagnostics", { ns: "errors" })}
          </Button>
          <Button onClick={() => void this.revealLogs()} variant="outline">
            {i18n.t("fatal.revealLogs", { ns: "errors" })}
          </Button>
          <Button onClick={() => window.location.reload()}>
            {i18n.t("fatal.reload", { ns: "errors" })}
          </Button>
        </div>
        {this.state.feedback !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            {this.state.feedback}
          </p>
        )}
      </main>
    );
  }

  private async copyDraft(draft: string): Promise<void> {
    try {
      await this.props.writeText(draft);
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
      await this.props.writeText(diagnostics.report);
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
}
