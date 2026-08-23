use tauri::{AppHandle, Emitter};

use crate::dto::{WorkspaceInvalidatedDto, display_path};
use crate::error::{DesktopError, Result};

pub(crate) const APP_STATE_INVALIDATED_EVENT: &str = "app-state-invalidated";
pub(crate) const QUICK_CAPTURE_SHOWN_EVENT: &str = "quick-capture-shown";
pub(crate) const OPEN_SETTINGS_EVENT: &str = "open-settings";
pub(crate) const SETTINGS_INVALIDATED_EVENT: &str = "settings-invalidated";
pub(crate) const INTEGRATIONS_INVALIDATED_EVENT: &str = "integrations-invalidated";

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
