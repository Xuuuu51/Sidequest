import { applicationKindForWindowLabel } from "./app-entry";
import { currentWindowLabel } from "./shared/tauri/window";
import { installGlobalErrorLogging } from "./shared/diagnostics/logger";
import { initializeI18n } from "./shared/i18n/bootstrap";
import { initializeTheme } from "./shared/theme/bootstrap";
import "./globals.css";

installGlobalErrorLogging();

async function start(): Promise<void> {
  await Promise.all([initializeI18n(), initializeTheme()]);
  const applicationKind = applicationKindForWindowLabel(currentWindowLabel());
  const root = document.getElementById("root") as HTMLElement;
  if (applicationKind === "quickCapture") {
    const { mountQuickCapture } = await import("./app/quick-capture-root");
    mountQuickCapture(root);
    return;
  }
  const { mountMainWindow } = await import("./app/main-window-root");
  mountMainWindow(root);
}

void start();
