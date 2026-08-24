import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { resources, type SupportedLocale } from "./resources";

export const i18n = i18next.createInstance();

export async function initializeI18nForLocale(
  locale: SupportedLocale,
): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN"],
    defaultNS: "common",
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
}
