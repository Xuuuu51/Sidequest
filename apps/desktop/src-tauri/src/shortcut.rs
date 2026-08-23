use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::dto::{ShortcutModifierDto, ShortcutRegistrationDto, ShortcutSpecDto};
use crate::error::{DesktopError, Result};

pub(crate) const DEFAULT_SHORTCUT_KEY: &str = "Space";

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ShortcutModifier {
    Command,
    Control,
    Option,
    Shift,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutSpec {
    pub(crate) modifiers: Vec<ShortcutModifier>,
    pub(crate) key: String,
}

impl Default for ShortcutSpec {
    fn default() -> Self {
        Self {
            modifiers: vec![ShortcutModifier::Command, ShortcutModifier::Shift],
            key: DEFAULT_SHORTCUT_KEY.to_owned(),
        }
    }
}

impl ShortcutSpec {
    pub(crate) fn parse(dto: ShortcutSpecDto) -> Result<Self> {
        let mut modifiers = Vec::new();
        for modifier in dto.modifiers {
            let modifier = match modifier {
                ShortcutModifierDto::Command => ShortcutModifier::Command,
                ShortcutModifierDto::Control => ShortcutModifier::Control,
                ShortcutModifierDto::Option => ShortcutModifier::Option,
                ShortcutModifierDto::Shift => ShortcutModifier::Shift,
            };
            if !modifiers.contains(&modifier) {
                modifiers.push(modifier);
            }
        }
        let key = normalize_key(&dto.key)?;
        if !modifiers.iter().any(|modifier| {
            matches!(
                modifier,
                ShortcutModifier::Command | ShortcutModifier::Control | ShortcutModifier::Option
            )
        }) {
            return Err(DesktopError::InvalidShortcut {
                message: "Shortcut must include Command, Control, or Option".to_owned(),
            });
        }
        modifiers.sort_by_key(modifier_order);
        Ok(Self { modifiers, key })
    }

    pub(crate) fn accelerator(&self) -> String {
        self.modifiers
            .iter()
            .map(|modifier| match modifier {
                ShortcutModifier::Command => "Command",
                ShortcutModifier::Control => "Control",
                ShortcutModifier::Option => "Alt",
                ShortcutModifier::Shift => "Shift",
            })
            .chain(std::iter::once(self.key.as_str()))
            .collect::<Vec<_>>()
            .join("+")
    }

    pub(crate) fn display(&self) -> String {
        let modifiers = self.modifiers.iter().map(|modifier| match modifier {
            ShortcutModifier::Command => "⌘",
            ShortcutModifier::Control => "⌃",
            ShortcutModifier::Option => "⌥",
            ShortcutModifier::Shift => "⇧",
        });
        modifiers
            .chain(std::iter::once(display_key(&self.key)))
            .collect::<String>()
    }
}

impl From<&ShortcutSpec> for ShortcutSpecDto {
    fn from(shortcut: &ShortcutSpec) -> Self {
        Self {
            modifiers: shortcut
                .modifiers
                .iter()
                .map(|modifier| match modifier {
                    ShortcutModifier::Command => ShortcutModifierDto::Command,
                    ShortcutModifier::Control => ShortcutModifierDto::Control,
                    ShortcutModifier::Option => ShortcutModifierDto::Option,
                    ShortcutModifier::Shift => ShortcutModifierDto::Shift,
                })
                .collect(),
            key: shortcut.key.clone(),
            display: shortcut.display(),
        }
    }
}

#[derive(Debug)]
pub(crate) struct ShortcutManager {
    active: Option<ShortcutSpec>,
    configured: ShortcutSpec,
}

impl ShortcutManager {
    #[cfg(test)]
    pub(crate) fn unregistered(configured: ShortcutSpec) -> Self {
        Self {
            active: None,
            configured,
        }
    }

    pub(crate) fn start(app: &AppHandle, configured: ShortcutSpec) -> Self {
        let accelerator = configured.accelerator();
        let active = app
            .global_shortcut()
            .register(accelerator.as_str())
            .ok()
            .map(|()| configured.clone());
        Self { active, configured }
    }

    pub(crate) fn registration(&self) -> ShortcutRegistrationDto {
        if self.active.as_ref() == Some(&self.configured) {
            ShortcutRegistrationDto::Active
        } else {
            ShortcutRegistrationDto::Conflict
        }
    }

    pub(crate) fn replace(&mut self, app: &AppHandle, candidate: &ShortcutSpec) -> Result<()> {
        if self.active.as_ref() == Some(candidate) {
            self.configured = candidate.clone();
            return Ok(());
        }
        let previous = self.active.take();
        if let Some(shortcut) = &previous {
            let accelerator = shortcut.accelerator();
            if let Err(error) = app.global_shortcut().unregister(accelerator.as_str()) {
                self.active = previous;
                return Err(DesktopError::ShortcutConflict {
                    message: error.to_string(),
                });
            }
        }
        let candidate_accelerator = candidate.accelerator();
        if let Err(error) = app
            .global_shortcut()
            .register(candidate_accelerator.as_str())
        {
            if let Some(shortcut) = &previous {
                let accelerator = shortcut.accelerator();
                let _restore_result = app.global_shortcut().register(accelerator.as_str());
            }
            self.active = previous;
            return Err(DesktopError::ShortcutConflict {
                message: error.to_string(),
            });
        }
        self.active = Some(candidate.clone());
        self.configured = candidate.clone();
        Ok(())
    }

    pub(crate) fn restore(&mut self, app: &AppHandle, previous: ShortcutSpec) {
        if let Some(active) = self.active.take() {
            let accelerator = active.accelerator();
            let _unregister_result = app.global_shortcut().unregister(accelerator.as_str());
        }
        let accelerator = previous.accelerator();
        let active = app
            .global_shortcut()
            .register(accelerator.as_str())
            .ok()
            .map(|()| previous.clone());
        self.configured = previous;
        self.active = active;
    }
}

fn normalize_key(key: &str) -> Result<String> {
    let trimmed = key.trim();
    let valid = trimmed.eq_ignore_ascii_case("space")
        || matches!(
            trimmed,
            "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
        )
        || trimmed
            .strip_prefix('F')
            .and_then(|value| value.parse::<u8>().ok())
            .is_some_and(|value| (1..=12).contains(&value))
        || (trimmed.len() == 1 && trimmed.as_bytes()[0].is_ascii_alphanumeric());
    if !valid {
        return Err(DesktopError::InvalidShortcut {
            message: "Use a letter, number, Space, arrow key, or F1–F12".to_owned(),
        });
    }
    if trimmed.len() == 1 {
        Ok(trimmed.to_ascii_uppercase())
    } else if trimmed.eq_ignore_ascii_case("space") {
        Ok(DEFAULT_SHORTCUT_KEY.to_owned())
    } else {
        Ok(trimmed.to_owned())
    }
}

fn modifier_order(modifier: &ShortcutModifier) -> u8 {
    match modifier {
        ShortcutModifier::Command => 0,
        ShortcutModifier::Control => 1,
        ShortcutModifier::Option => 2,
        ShortcutModifier::Shift => 3,
    }
}

fn display_key(key: &str) -> &str {
    match key {
        "Space" => "Space",
        "ArrowUp" => "↑",
        "ArrowDown" => "↓",
        "ArrowLeft" => "←",
        "ArrowRight" => "→",
        _ => key,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shortcut_should_reject_shift_only() {
        let result = ShortcutSpec::parse(ShortcutSpecDto {
            modifiers: vec![ShortcutModifierDto::Shift],
            key: "K".to_owned(),
            display: String::new(),
        });

        assert!(result.is_err());
    }

    #[test]
    fn shortcut_should_normalize_and_display_supported_key() -> Result<()> {
        let shortcut = ShortcutSpec::parse(ShortcutSpecDto {
            modifiers: vec![ShortcutModifierDto::Shift, ShortcutModifierDto::Command],
            key: "k".to_owned(),
            display: String::new(),
        })?;

        assert_eq!(shortcut.accelerator(), "Command+Shift+K");
        assert_eq!(shortcut.display(), "⌘⇧K");
        Ok(())
    }
}
