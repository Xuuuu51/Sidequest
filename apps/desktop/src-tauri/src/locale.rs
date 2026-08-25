use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub(crate) enum LanguagePreference {
    #[default]
    #[serde(rename = "system")]
    System,
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh-CN")]
    SimplifiedChinese,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
pub(crate) enum EffectiveLocale {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh-CN")]
    SimplifiedChinese,
}

impl LanguagePreference {
    pub(crate) fn effective(self) -> EffectiveLocale {
        match self {
            Self::English => EffectiveLocale::English,
            Self::SimplifiedChinese => EffectiveLocale::SimplifiedChinese,
            Self::System => effective_system_locale(sys_locale::get_locales()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeTranslations {
    pub(crate) app: NativeAppTranslations,
    pub(crate) menu: NativeMenuTranslations,
    pub(crate) status_item: NativeStatusItemTranslations,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeAppTranslations {
    pub(crate) about: String,
    pub(crate) open: String,
    pub(crate) quick_capture: String,
    pub(crate) settings: String,
    pub(crate) quit: String,
    pub(crate) services: String,
    pub(crate) hide: String,
    pub(crate) hide_others: String,
    pub(crate) show_all: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeMenuTranslations {
    pub(crate) file: String,
    pub(crate) edit: String,
    pub(crate) view: String,
    pub(crate) window: String,
    #[cfg(debug_assertions)]
    pub(crate) debug: String,
    pub(crate) close_window: String,
    pub(crate) undo: String,
    pub(crate) redo: String,
    pub(crate) cut: String,
    pub(crate) copy: String,
    pub(crate) paste: String,
    pub(crate) select_all: String,
    pub(crate) enter_full_screen: String,
    pub(crate) minimize: String,
    pub(crate) zoom: String,
    #[cfg(debug_assertions)]
    pub(crate) open_dev_tools: String,
    #[cfg(debug_assertions)]
    pub(crate) reload_active_window: String,
    #[cfg(debug_assertions)]
    pub(crate) open_logs: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeStatusItemTranslations {
    pub(crate) show_main_window: String,
    pub(crate) hide_main_window: String,
}

pub(crate) fn native_translations(locale: EffectiveLocale) -> &'static NativeTranslations {
    static ENGLISH: OnceLock<NativeTranslations> = OnceLock::new();
    static SIMPLIFIED_CHINESE: OnceLock<NativeTranslations> = OnceLock::new();
    match locale {
        EffectiveLocale::English => ENGLISH.get_or_init(|| {
            parse_native_translations(include_str!("../../locales/en/native.json"))
        }),
        EffectiveLocale::SimplifiedChinese => SIMPLIFIED_CHINESE.get_or_init(|| {
            parse_native_translations(include_str!("../../locales/zh-CN/native.json"))
        }),
    }
}

fn parse_native_translations(source: &str) -> NativeTranslations {
    serde_json::from_str(source)
        .unwrap_or_else(|error| panic!("bundled native translations must be valid: {error}"))
}

fn effective_system_locale(locales: impl IntoIterator<Item = String>) -> EffectiveLocale {
    for locale in locales {
        let normalized = locale.replace('_', "-").to_ascii_lowercase();
        if normalized == "zh-cn"
            || normalized == "zh-sg"
            || normalized == "zh-hans"
            || normalized.starts_with("zh-hans-")
        {
            return EffectiveLocale::SimplifiedChinese;
        }
        if normalized == "en" || normalized.starts_with("en-") {
            return EffectiveLocale::English;
        }
    }
    EffectiveLocale::English
}

#[cfg(test)]
mod tests {
    use super::{
        EffectiveLocale, LanguagePreference, effective_system_locale, native_translations,
    };

    #[test]
    fn simplified_chinese_system_locales_should_map_to_zh_cn() {
        for locale in ["zh-CN", "zh_SG", "zh-Hans", "zh-Hans-US"] {
            assert_eq!(
                effective_system_locale([locale.to_owned()]),
                EffectiveLocale::SimplifiedChinese
            );
        }
    }

    #[test]
    fn traditional_chinese_should_not_map_to_simplified_chinese() {
        for locale in ["zh-TW", "zh-HK", "zh-MO", "zh-Hant"] {
            assert_eq!(
                effective_system_locale([locale.to_owned()]),
                EffectiveLocale::English
            );
        }
    }

    #[test]
    fn system_locale_should_consider_later_supported_preferences() {
        assert_eq!(
            effective_system_locale(["fr-FR".to_owned(), "zh-CN".to_owned()]),
            EffectiveLocale::SimplifiedChinese
        );
    }

    #[test]
    fn explicit_language_should_not_consult_the_system() {
        assert_eq!(
            LanguagePreference::English.effective(),
            EffectiveLocale::English
        );
        assert_eq!(
            LanguagePreference::SimplifiedChinese.effective(),
            EffectiveLocale::SimplifiedChinese
        );
    }

    #[test]
    fn bundled_native_resources_should_load_for_both_languages() {
        assert_eq!(
            native_translations(EffectiveLocale::English).app.open,
            "Open Sidequest"
        );
        assert_eq!(
            native_translations(EffectiveLocale::SimplifiedChinese)
                .app
                .open,
            "打开 Sidequest"
        );
        assert_eq!(
            native_translations(EffectiveLocale::English)
                .status_item
                .show_main_window,
            "Show Main Window"
        );
        assert_eq!(
            native_translations(EffectiveLocale::SimplifiedChinese)
                .status_item
                .hide_main_window,
            "隐藏主窗口"
        );
    }
}
