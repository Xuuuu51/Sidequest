use tauri::{AppHandle, Emitter};

use crate::dto::{EffectiveLocaleDto, ThemePreferenceDto, WorkspaceInvalidatedDto, display_path};
use crate::error::{DesktopError, Result};

pub(crate) const APP_STATE_INVALIDATED_EVENT: &str = "app-state-invalidated";
pub(crate) const QUICK_CAPTURE_CLOSE_REQUESTED_EVENT: &str = "quick-capture-close-requested";
pub(crate) const QUICK_CAPTURE_SHOWN_EVENT: &str = "quick-capture-shown";
pub(crate) const OPEN_SETTINGS_EVENT: &str = "open-settings";
pub(crate) const HIDE_MAIN_WINDOW_REQUESTED_EVENT: &str = "hide-main-window-requested";
pub(crate) const SETTINGS_INVALIDATED_EVENT: &str = "settings-invalidated";
pub(crate) const INTEGRATIONS_INVALIDATED_EVENT: &str = "integrations-invalidated";
pub(crate) const LOCALE_CHANGED_EVENT: &str = "locale-changed";
pub(crate) const THEME_CHANGED_EVENT: &str = "theme-changed";

pub(crate) fn emit_app_state_invalidated(app: &AppHandle) -> Result<()> {
    app.emit(APP_STATE_INVALIDATED_EVENT, ())
        .map_err(|error| DesktopError::Window {
            operation: "emit app-state-invalidated",
            message: error.to_string(),
        })
}

pub(crate) fn emit_settings_invalidated(app: &AppHandle) -> Result<()> {
    app.emit(SETTINGS_INVALIDATED_EVENT, ())
        .map_err(|error| DesktopError::Window {
            operation: "emit settings-invalidated",
            message: error.to_string(),
        })
}

pub(crate) fn emit_integrations_invalidated(app: &AppHandle) -> Result<()> {
    app.emit(INTEGRATIONS_INVALIDATED_EVENT, ())
        .map_err(|error| DesktopError::Window {
            operation: "emit integrations-invalidated",
            message: error.to_string(),
        })
}

pub(crate) fn emit_locale_changed(app: &AppHandle, locale: EffectiveLocaleDto) -> Result<()> {
    app.emit(LOCALE_CHANGED_EVENT, locale)
        .map_err(|error| DesktopError::Window {
            operation: "emit locale-changed",
            message: error.to_string(),
        })
}

pub(crate) fn emit_theme_changed(app: &AppHandle, preference: ThemePreferenceDto) -> Result<()> {
    app.emit(THEME_CHANGED_EVENT, preference)
        .map_err(|error| DesktopError::Window {
            operation: "emit theme-changed",
            message: error.to_string(),
        })
}

pub(crate) fn emit_workspace_invalidated(
    app: &AppHandle,
    project_path: &std::path::Path,
) -> Result<()> {
    app.emit(
        crate::watcher::WORKSPACE_INVALIDATED_EVENT,
        WorkspaceInvalidatedDto {
            project_path: display_path(project_path),
        },
    )
    .map_err(|error| DesktopError::Window {
        operation: "emit workspace-invalidated",
        message: error.to_string(),
    })
}
