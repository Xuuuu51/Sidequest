import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  EffectiveLocale,
  ThemePreference,
  WorkspaceInvalidatedDto,
} from "./types";

export const WORKSPACE_INVALIDATED_EVENT = "workspace-invalidated";
export const APP_QUIT_REQUESTED_EVENT = "app-quit-requested";
export const APP_STATE_INVALIDATED_EVENT = "app-state-invalidated";
export const QUICK_CAPTURE_CLOSE_REQUESTED_EVENT =
  "quick-capture-close-requested";
export const QUICK_CAPTURE_SHOWN_EVENT = "quick-capture-shown";
export const OPEN_SETTINGS_EVENT = "open-settings";
export const SETTINGS_INVALIDATED_EVENT = "settings-invalidated";
export const INTEGRATIONS_INVALIDATED_EVENT = "integrations-invalidated";
export const DEBUG_RELOAD_REQUESTED_EVENT = "debug-reload-requested";
export const LOCALE_CHANGED_EVENT = "locale-changed";
export const THEME_CHANGED_EVENT = "theme-changed";

export function listenForWorkspaceInvalidation(
  handler: (payload: WorkspaceInvalidatedDto) => void,
): Promise<UnlistenFn> {
  return listen<WorkspaceInvalidatedDto>(WORKSPACE_INVALIDATED_EVENT, (event) =>
    handler(event.payload),
  );
}

export function listenForOpenSettings(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(OPEN_SETTINGS_EVENT, handler);
}

export function listenForSettingsInvalidation(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(SETTINGS_INVALIDATED_EVENT, handler);
}

export function listenForIntegrationsInvalidation(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(INTEGRATIONS_INVALIDATED_EVENT, handler);
}

export function listenForAppQuitRequest(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(APP_QUIT_REQUESTED_EVENT, handler);
}

export function listenForAppStateInvalidation(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(APP_STATE_INVALIDATED_EVENT, handler);
}

export function listenForQuickCaptureShown(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(QUICK_CAPTURE_SHOWN_EVENT, handler);
}

export function listenForQuickCaptureCloseRequest(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(QUICK_CAPTURE_CLOSE_REQUESTED_EVENT, handler);
}

export function listenForDebugReloadRequest(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(DEBUG_RELOAD_REQUESTED_EVENT, handler);
}

export function listenForLocaleChange(
  handler: (locale: EffectiveLocale) => void,
): Promise<UnlistenFn> {
  return listen<EffectiveLocale>(LOCALE_CHANGED_EVENT, (event) =>
    handler(event.payload),
  );
}

export function listenForThemeChange(
  handler: (preference: ThemePreference) => void,
): Promise<UnlistenFn> {
  return listen<ThemePreference>(THEME_CHANGED_EVENT, (event) =>
    handler(event.payload),
  );
}
