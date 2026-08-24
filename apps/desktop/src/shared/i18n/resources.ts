import commonEn from "../../../locales/en/common.json";
import errorsEn from "../../../locales/en/errors.json";
import mainWindowEn from "../../../locales/en/main-window.json";
import nativeEn from "../../../locales/en/native.json";
import onboardingEn from "../../../locales/en/onboarding.json";
import quickCaptureEn from "../../../locales/en/quick-capture.json";
import settingsEn from "../../../locales/en/settings.json";
import commonZhCn from "../../../locales/zh-CN/common.json";
import errorsZhCn from "../../../locales/zh-CN/errors.json";
import mainWindowZhCn from "../../../locales/zh-CN/main-window.json";
import nativeZhCn from "../../../locales/zh-CN/native.json";
import onboardingZhCn from "../../../locales/zh-CN/onboarding.json";
import quickCaptureZhCn from "../../../locales/zh-CN/quick-capture.json";
import settingsZhCn from "../../../locales/zh-CN/settings.json";

export const defaultResources = {
  common: commonEn,
  errors: errorsEn,
  "main-window": mainWindowEn,
  native: nativeEn,
  onboarding: onboardingEn,
  "quick-capture": quickCaptureEn,
  settings: settingsEn,
} as const;

export const resources = {
  en: defaultResources,
  "zh-CN": {
    common: commonZhCn,
    errors: errorsZhCn,
    "main-window": mainWindowZhCn,
    native: nativeZhCn,
    onboarding: onboardingZhCn,
    "quick-capture": quickCaptureZhCn,
    settings: settingsZhCn,
  },
} as const;

export type SupportedLocale = keyof typeof resources;
export type TranslationNamespace = keyof typeof defaultResources;
