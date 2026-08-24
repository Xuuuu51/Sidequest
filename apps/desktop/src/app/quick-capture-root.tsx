import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import { QuickCaptureApp } from "../features/quick-capture/quick-capture-app";
import { ApplicationErrorBoundary } from "../shared/diagnostics/error-boundary";
import { LocaleListener } from "../shared/i18n/locale-listener";
import { createDesktopQueryClient } from "../shared/query/client";
import { ThemeProvider } from "../shared/theme/theme-provider";
import { Toaster } from "../shared/ui/sonner";
import { useQuickCaptureStore } from "../store/quick-capture";

export function mountQuickCapture(root: HTMLElement): void {
  document.body.dataset.window = "quick-capture";
  const queryClient = createDesktopQueryClient();
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ApplicationErrorBoundary
        applicationKind="quickCapture"
        getDraft={currentQuickCaptureDraft}
        writeText={writeBrowserClipboard}
      >
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <LocaleListener>
              <QuickCaptureApp />
              <Toaster />
            </LocaleListener>
          </ThemeProvider>
        </QueryClientProvider>
      </ApplicationErrorBoundary>
    </React.StrictMode>,
  );
}

function currentQuickCaptureDraft(): string | null {
  const draft = useQuickCaptureStore.getState().draft;
  return draft.length > 0 ? draft : null;
}

function writeBrowserClipboard(value: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText !== "function") {
    return Promise.reject(new Error("Browser clipboard is unavailable"));
  }
  return navigator.clipboard.writeText(value);
}
