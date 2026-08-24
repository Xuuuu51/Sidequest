use std::process::Command;
use std::sync::MutexGuard;

use chrono::{SecondsFormat, Utc};
#[cfg(debug_assertions)]
use tauri::Manager;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::app_state::{APP_STATE_SCHEMA_VERSION, AppStateStore, DesktopState};
use crate::dto::{
    CommandErrorDto, DiagnosticReportDto, IntegrationIdDto, IntegrationItemDto,
    IntegrationStateDto, ProjectStateDto,
};
use crate::error::{DesktopError, Result};
use crate::integration;
use crate::runtime_paths::RuntimePaths;

type CommandResult<T> = std::result::Result<T, CommandErrorDto>;

#[tauri::command]
pub(crate) fn get_diagnostic_report(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<DiagnosticReportDto> {
    let store = lock_store(&state).map_err(CommandErrorDto::from)?;
    let projects = store.snapshot().projects;
    let integrations = integration::status(&app_handle, &store, &paths);
    let shortcut_registration = state
        .shortcut
        .lock()
        .map_err(|_| DesktopError::StateLock)
        .map(|manager| manager.registration())
        .map_err(CommandErrorDto::from)?;
    let generated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let report = build_report(DiagnosticData {
        generated_at: &generated_at,
        app_version: env!("CARGO_PKG_VERSION"),
        macos_version: &macos_version(),
        architecture: std::env::consts::ARCH,
        build_mode: if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        },
        isolated_profile: paths.is_isolated(),
        projects: &projects,
        shortcut_registration,
        integrations: &integrations,
    });
    Ok(DiagnosticReportDto {
        generated_at,
        report,
    })
}

#[tauri::command]
pub(crate) fn reveal_diagnostic_logs(
    app_handle: AppHandle,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<()> {
    app_handle
        .opener()
        .reveal_item_in_dir(paths.log_directory())
        .map_err(|error| DesktopError::Window {
            operation: "reveal diagnostic logs",
            message: error.to_string(),
        })
        .map_err(CommandErrorDto::from)
}

#[cfg(debug_assertions)]
pub(crate) fn reveal_logs(app_handle: &AppHandle) -> Result<()> {
    let paths = app_handle
        .try_state::<RuntimePaths>()
        .ok_or(DesktopError::StateLock)?;
    app_handle
        .opener()
        .reveal_item_in_dir(paths.log_directory())
        .map_err(|error| DesktopError::Window {
            operation: "reveal diagnostic logs",
            message: error.to_string(),
        })
}

fn lock_store(state: &DesktopState) -> Result<MutexGuard<'_, AppStateStore>> {
    state.app_state.lock().map_err(|_| DesktopError::StateLock)
}

struct DiagnosticData<'a> {
    generated_at: &'a str,
    app_version: &'a str,
    macos_version: &'a str,
    architecture: &'a str,
    build_mode: &'a str,
    isolated_profile: bool,
    projects: &'a [crate::dto::ProjectDto],
    shortcut_registration: crate::dto::ShortcutRegistrationDto,
    integrations: &'a [IntegrationItemDto],
}

fn build_report(data: DiagnosticData<'_>) -> String {
    let writable = data
        .projects
        .iter()
        .filter(|project| project.state == ProjectStateDto::Writable)
        .count();
    let read_only = data
        .projects
        .iter()
        .filter(|project| project.state == ProjectStateDto::ReadOnly)
        .count();
    let unavailable = data
        .projects
        .iter()
        .filter(|project| project.state == ProjectStateDto::Unavailable)
        .count();
    let integration_lines = [
        IntegrationIdDto::Cli,
        IntegrationIdDto::Codex,
        IntegrationIdDto::Claude,
    ]
    .map(|id| {
        let state = data
            .integrations
            .iter()
            .find(|item| item.id == id)
            .map_or("unavailable", |item| integration_state(item.state));
        format!("{}: {state}", integration_name(id))
    })
    .join("\n");
    format!(
        "Sidequest Diagnostics\n\
Generated: {}\n\
Version: {}\n\
Build: {}\n\
macOS: {}\n\
Architecture: {}\n\
App State Schema: {}\n\
Isolated Profile: {}\n\
Projects: {} (writable: {writable}, read-only: {read_only}, unavailable: {unavailable})\n\
Shortcut: {}\n\
{integration_lines}",
        data.generated_at,
        data.app_version,
        data.build_mode,
        data.macos_version,
        data.architecture,
        APP_STATE_SCHEMA_VERSION,
        if data.isolated_profile { "yes" } else { "no" },
        data.projects.len(),
        match data.shortcut_registration {
            crate::dto::ShortcutRegistrationDto::Active => "active",
            crate::dto::ShortcutRegistrationDto::Conflict => "conflict",
        }
    )
}

const fn integration_name(id: IntegrationIdDto) -> &'static str {
    match id {
        IntegrationIdDto::Cli => "sq CLI",
        IntegrationIdDto::Codex => "Codex Skill",
        IntegrationIdDto::Claude => "Claude Skill",
    }
}

const fn integration_state(state: IntegrationStateDto) -> &'static str {
    match state {
        IntegrationStateDto::Installed => "installed",
        IntegrationStateDto::NotInstalled => "not installed",
        IntegrationStateDto::UpdateAvailable => "update available",
        IntegrationStateDto::RepairRequired => "repair required",
        IntegrationStateDto::Conflict => "conflict",
        IntegrationStateDto::Unavailable => "unavailable",
    }
}

#[cfg(target_os = "macos")]
fn macos_version() -> String {
    Command::new("/usr/bin/sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map_or_else(|| "unknown".to_owned(), |version| version.trim().to_owned())
}

#[cfg(not(target_os = "macos"))]
fn macos_version() -> String {
    "not macOS".to_owned()
}

#[cfg(test)]
mod tests {
    use super::{DiagnosticData, build_report};
    use crate::dto::{
        IntegrationIdDto, IntegrationItemDto, IntegrationStateDto, ProjectDto, ProjectStateDto,
        ShortcutRegistrationDto,
    };

    #[test]
    fn report_should_include_counts_without_project_paths() {
        let projects = vec![ProjectDto {
            path: "/Users/developer/private-project".to_owned(),
            name: "private-project".to_owned(),
            state: ProjectStateDto::Writable,
        }];
        let integrations = vec![integration(IntegrationIdDto::Cli)];

        let report = build_report(DiagnosticData {
            generated_at: "2026-08-24T00:00:00Z",
            app_version: "0.1.0",
            macos_version: "15.0",
            architecture: "aarch64",
            build_mode: "debug",
            isolated_profile: true,
            projects: &projects,
            shortcut_registration: ShortcutRegistrationDto::Active,
            integrations: &integrations,
        });

        assert!(report.contains("Projects: 1 (writable: 1"));
        assert!(!report.contains("private-project"));
    }

    fn integration(id: IntegrationIdDto) -> IntegrationItemDto {
        IntegrationItemDto {
            id,
            state: IntegrationStateDto::Installed,
            path: "/private/path".to_owned(),
            installed_version: Some("0.1.0".to_owned()),
            bundled_version: "0.1.0".to_owned(),
            message: None,
        }
    }
}
