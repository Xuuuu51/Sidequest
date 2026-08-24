import { getCurrentWindow, type Theme } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";

export function currentWindowLabel(): string {
  return getCurrentWindow().label;
}

export function setCurrentWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}

export function setCurrentWindowTheme(theme: Theme | null): Promise<void> {
  return getCurrentWindow().setTheme(theme);
}

export function getCurrentWindowTheme(): Promise<Theme | null> {
  return getCurrentWindow().theme();
}

export function listenForCurrentWindowThemeChange(
  handler: (theme: Theme) => void,
): Promise<UnlistenFn> {
  return getCurrentWindow().onThemeChanged((event) => handler(event.payload));
}

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function listenForCurrentWindowClose(
  handler: () => void,
): Promise<UnlistenFn> {
  return getCurrentWindow().onCloseRequested((event) => {
    event.preventDefault();
    handler();
  });
}

export function listenForCurrentWindowMove(
  handler: () => void,
): Promise<UnlistenFn> {
  return getCurrentWindow().onMoved(handler);
}

export function listenForCurrentWindowResize(
  handler: () => void,
): Promise<UnlistenFn> {
  return getCurrentWindow().onResized(handler);
}
