use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

#[cfg(test)]
mod tests {
    use super::ThemePreference;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn preference_should_use_stable_camel_case_values() -> TestResult {
        assert_eq!(
            serde_json::to_string(&ThemePreference::System)?,
            r#""system""#
        );
        assert_eq!(
            serde_json::to_string(&ThemePreference::Light)?,
            r#""light""#
        );
        assert_eq!(serde_json::to_string(&ThemePreference::Dark)?, r#""dark""#);
        Ok(())
    }
}
