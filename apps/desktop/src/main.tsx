import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { applicationKindForWindowLabel } from "./app-entry";
import { QuickCaptureApp } from "./features/quick-capture/quick-capture-app";
import { createDesktopQueryClient } from "./shared/query/client";
import { currentWindowLabel } from "./shared/tauri/window";
import "./App.css";

const queryClient = createDesktopQueryClient();
const application =
  applicationKindForWindowLabel(currentWindowLabel()) === "quickCapture" ? (
    <QuickCaptureApp />
  ) : (
    <App />
  );

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {application}
    </QueryClientProvider>
  </React.StrictMode>,
);
