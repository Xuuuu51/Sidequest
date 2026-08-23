import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { WorkspaceInvalidatedDto } from "./types";

export const WORKSPACE_INVALIDATED_EVENT = "workspace-invalidated";
export const APP_QUIT_REQUESTED_EVENT = "app-quit-requested";
export const APP_STATE_INVALIDATED_EVENT = "app-state-invalidated";
export const QUICK_CAPTURE_SHOWN_EVENT = "quick-capture-shown";
export const OPEN_SETTINGS_EVENT = "open-settings";
export const SETTINGS_INVALIDATED_EVENT = "settings-invalidated";
export const INTEGRATIONS_INVALIDATED_EVENT = "integrations-invalidated";

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
