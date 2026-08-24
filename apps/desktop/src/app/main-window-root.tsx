import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import { MainWindowApp } from "./main-window-app";
import { ApplicationErrorBoundary } from "../shared/diagnostics/error-boundary";
import { LocaleListener } from "../shared/i18n/locale-listener";
import { createDesktopQueryClient } from "../shared/query/client";
import { ThemeProvider } from "../shared/theme/theme-provider";
import { Toaster } from "../shared/ui/sonner";
import { writeClipboardText } from "../shared/tauri/commands";
import { useMainWindowStore } from "../store/main-window/store";

export function mountMainWindow(root: HTMLElement): void {
  const queryClient = createDesktopQueryClient();
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ApplicationErrorBoundary
        applicationKind="main"
        getDraft={currentMainWindowDraft}
        writeText={writeClipboardText}
      >
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <LocaleListener>
              <MainWindowApp />
              <Toaster />
            </LocaleListener>
          </ThemeProvider>
        </QueryClientProvider>
      </ApplicationErrorBoundary>
    </React.StrictMode>,
  );
}

function currentMainWindowDraft(): string | null {
  const editor = useMainWindowStore.getState().editor;
  if (editor === null || editor.draftContent === editor.baseContent)
    return null;
  return editor.draftContent;
}
