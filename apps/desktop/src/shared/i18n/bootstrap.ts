import { getLocaleSettings } from "../tauri/commands";
import { initializeI18nForLocale } from "./i18n";
import type { SupportedLocale } from "./resources";

export async function initializeI18n(): Promise<void> {
  let locale: SupportedLocale = "en";
  try {
    locale = (await getLocaleSettings()).effectiveLocale;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Could not load locale settings", error);
    }
  }
  await initializeI18nForLocale(locale);
}
