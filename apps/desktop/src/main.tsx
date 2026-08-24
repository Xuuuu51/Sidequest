import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { applicationKindForWindowLabel } from "./app-entry";
import { QuickCaptureApp } from "./features/quick-capture/quick-capture-app";
import { createDesktopQueryClient } from "./shared/query/client";
import { currentWindowLabel } from "./shared/tauri/window";
import { ApplicationErrorBoundary } from "./shared/diagnostics/error-boundary";
import { installGlobalErrorLogging } from "./shared/diagnostics/logger";
import { initializeI18n } from "./shared/i18n/bootstrap";
import { LocaleListener } from "./shared/i18n/locale-listener";
import "./App.css";

installGlobalErrorLogging();

async function start(): Promise<void> {
  await initializeI18n();
  const queryClient = createDesktopQueryClient();
  const applicationKind = applicationKindForWindowLabel(currentWindowLabel());
  const application =
    applicationKind === "quickCapture" ? <QuickCaptureApp /> : <App />;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ApplicationErrorBoundary applicationKind={applicationKind}>
        <QueryClientProvider client={queryClient}>
          <LocaleListener>{application}</LocaleListener>
        </QueryClientProvider>
      </ApplicationErrorBoundary>
    </React.StrictMode>,
  );
}

void start();
