import { logFrontendError } from "../diagnostics/logger";
import {
  getCurrentWindowTheme,
  isTauriRuntime,
  setCurrentWindowTheme,
} from "../tauri/window";
import type { EffectiveTheme, ThemePreference } from "../tauri/types";

let preference: ThemePreference = "system";
let requestId = 0;

export const themeSettingsKey = ["theme-settings"] as const;

export function currentThemePreference(): ThemePreference {
  return preference;
}

export function systemThemeFallback(): EffectiveTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyDocumentTheme(theme: EffectiveTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export async function applyThemePreference(
  nextPreference: ThemePreference,
): Promise<EffectiveTheme> {
  preference = nextPreference;
  const ownRequest = ++requestId;
  let effectiveTheme: EffectiveTheme =
    nextPreference === "system" ? systemThemeFallback() : nextPreference;
  applyDocumentTheme(effectiveTheme);

  if (!isTauriRuntime()) {
    return effectiveTheme;
  }

  try {
    await setCurrentWindowTheme(
      nextPreference === "system" ? null : nextPreference,
    );
    if (nextPreference === "system") {
      effectiveTheme = (await getCurrentWindowTheme()) ?? systemThemeFallback();
    }
  } catch (error) {
    logFrontendError("window theme application failed", error);
  }

  if (ownRequest === requestId) {
    applyDocumentTheme(effectiveTheme);
  }
  return effectiveTheme;
}
