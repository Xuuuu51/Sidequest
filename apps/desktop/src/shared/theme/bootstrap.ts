import { getThemeSettings } from "../tauri/commands";
import type { ThemePreference } from "../tauri/types";
import { isTauriRuntime } from "../tauri/window";
import { applyThemePreference } from "./theme";

export async function initializeTheme(): Promise<ThemePreference> {
  let preference: ThemePreference = "system";
  if (isTauriRuntime()) {
    try {
      preference = (await getThemeSettings()).preference;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Could not load theme settings", error);
      }
    }
  }
  await applyThemePreference(preference);
  return preference;
}
