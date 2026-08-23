import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";

const currentWindow = getCurrentWindow();

export function currentWindowLabel(): string {
  return currentWindow.label;
}

export function listenForCurrentWindowClose(
  handler: () => void,
): Promise<UnlistenFn> {
  return currentWindow.onCloseRequested((event) => {
    event.preventDefault();
    handler();
  });
}

export function listenForCurrentWindowMove(
  handler: () => void,
): Promise<UnlistenFn> {
  return currentWindow.onMoved(handler);
}
