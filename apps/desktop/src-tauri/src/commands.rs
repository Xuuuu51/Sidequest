use std::path::Path;
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};

use sidequest_core::{CreateQuest, QuestId, QuestStatus, Workspace, open_workspace};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;

use crate::app_state::{AppStateStore, DesktopState, OnboardingStep};
use crate::dto::{
    AppStateDto, CommandErrorDto, DeletedQuestDto, IntegrationIdDto, IntegrationItemDto,
    LanguagePreferenceDto, LocaleSettingsDto, OnboardingStepDto, PanelPreferencesDto, QuestDto,
    QuickCaptureResultDto, SettingsDto, ShortcutSpecDto, ThemePreferenceDto, ThemeSettingsDto,
    WorkspaceSnapshotDto,
};
use crate::error::{DesktopError, Result};
use crate::integration;
use crate::native_events::{
    emit_app_state_invalidated, emit_integrations_invalidated, emit_locale_changed,
    emit_settings_invalidated, emit_theme_changed, emit_workspace_invalidated,
};
use crate::quick_capture_window::{
    QUICK_CAPTURE_WINDOW_LABEL, capture_quick_capture_position, focus_quick_capture_window,
    hide_quick_capture_window, show_quick_capture_window,
};
use crate::runtime_paths::RuntimePaths;
use crate::shortcut::ShortcutSpec;
use crate::watcher::ProjectWatcher;
use crate::window_state::capture_main_window;

type CommandResult<T> = std::result::Result<T, CommandErrorDto>;

#[tauri::command]
pub(crate) fn get_locale_settings(
    state: State<'_, DesktopState>,
) -> CommandResult<LocaleSettingsDto> {
    app_state_lock(&state)
        .map(|store| locale_settings(store.language_preference()))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn set_locale_preference(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    preference: LanguagePreferenceDto,
) -> CommandResult<LocaleSettingsDto> {
    let preference: crate::locale::LanguagePreference = preference.into();
    let effective_locale = preference.effective();
    let menu = crate::app_menu::build_for_locale(&app_handle, effective_locale)
        .map_err(|error| DesktopError::Window {
            operation: "build localized application menu",
            message: error.to_string(),
        })
        .map_err(CommandErrorDto::from)?;
    let previous = app_state_lock(&state)
        .map(|store| store.language_preference())
        .map_err(CommandErrorDto::from)?;
    app_state_lock(&state)
        .and_then(|mut store| store.set_language_preference(preference))
        .map_err(CommandErrorDto::from)?;
    if let Err(error) = app_handle.set_menu(menu) {
        if let Err(rollback_error) =
            app_state_lock(&state).and_then(|mut store| store.set_language_preference(previous))
        {
            log::error!("could not roll back language preference: {rollback_error}");
        }
        return Err(CommandErrorDto::from(DesktopError::Window {
            operation: "apply localized application menu",
            message: error.to_string(),
        }));
    }
    #[cfg(target_os = "macos")]
    if let Err(error) = crate::status_item::update_locale(&app_handle, effective_locale) {
        if let Err(rollback_error) =
            app_state_lock(&state).and_then(|mut store| store.set_language_preference(previous))
        {
            log::error!("could not roll back language preference: {rollback_error}");
        }
        match crate::app_menu::build_for_locale(&app_handle, previous.effective()) {
            Ok(previous_menu) => {
                if let Err(rollback_error) = app_handle.set_menu(previous_menu) {
                    log::error!("could not restore application menu locale: {rollback_error}");
                }
            }
            Err(rollback_error) => {
                log::error!("could not rebuild previous application menu: {rollback_error}");
            }
        }
        if let Err(rollback_error) =
            crate::status_item::update_locale(&app_handle, previous.effective())
        {
            log::error!("could not restore status item locale: {rollback_error}");
        }
        return Err(CommandErrorDto::from(DesktopError::Window {
            operation: "apply localized status item menu",
            message: error.to_string(),
        }));
    }
    let settings = locale_settings(preference);
    log_event_result(
        "notify windows after language update",
        emit_locale_changed(&app_handle, settings.effective_locale),
    );
    log_event_result(
        "invalidate settings after language update",
        emit_settings_invalidated(&app_handle),
    );
    Ok(settings)
}

#[tauri::command]
pub(crate) fn get_theme_settings(
    state: State<'_, DesktopState>,
) -> CommandResult<ThemeSettingsDto> {
    app_state_lock(&state)
        .map(|store| theme_settings(store.theme_preference()))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn set_theme_preference(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    preference: ThemePreferenceDto,
) -> CommandResult<ThemeSettingsDto> {
    let preference: crate::theme::ThemePreference = preference.into();
    app_state_lock(&state)
        .and_then(|mut store| store.set_theme_preference(preference))
        .map_err(CommandErrorDto::from)?;
    let settings = theme_settings(preference);
    log_event_result(
        "notify windows after theme update",
        emit_theme_changed(&app_handle, settings.preference),
    );
    log_event_result(
        "invalidate settings after theme update",
        emit_settings_invalidated(&app_handle),
    );
    Ok(settings)
}

#[tauri::command]
pub(crate) fn get_app_state(state: State<'_, DesktopState>) -> CommandResult<AppStateDto> {
    app_state_lock(&state)
        .map(|store| store.snapshot())
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn add_project(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
    project_path: String,
) -> CommandResult<AppStateDto> {
    let snapshot = app_state_lock(&state)
        .and_then(|mut store| store.add_project(Path::new(&project_path)))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate app state after adding project",
        emit_app_state_invalidated(&app_handle),
    );
    if let Ok(mut store) = app_state_lock(&state)
        && let Err(error) = integration::auto_maintain_cli(&app_handle, &mut store, &paths)
    {
        log::warn!("automatic CLI maintenance failed: {error}");
    }
    log_event_result(
        "invalidate integrations after adding project",
        emit_integrations_invalidated(&app_handle),
    );
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn get_settings(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<SettingsDto> {
    let shortcut = app_state_lock(&state)
        .map(|store| store.shortcut())
        .map_err(CommandErrorDto::from)?;
    let registration = lock(&state.shortcut)
        .map(|manager| manager.registration())
        .map_err(CommandErrorDto::from)?;
    let launch_at_login = if paths.is_isolated() {
        false
    } else {
        app_handle
            .autolaunch()
            .is_enabled()
            .map_err(|error| DesktopError::Window {
                operation: "read Launch at Login setting",
                message: error.to_string(),
            })
            .map_err(CommandErrorDto::from)?
    };
    Ok(SettingsDto {
        shortcut: ShortcutSpecDto::from(&shortcut),
        shortcut_registration: registration,
        launch_at_login,
        launch_at_login_available: !paths.is_isolated(),
        debug_profile: paths.is_isolated(),
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        license_text: include_str!("../../../../LICENSE").to_owned(),
    })
}

#[tauri::command]
pub(crate) fn set_global_shortcut(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
    shortcut: ShortcutSpecDto,
) -> CommandResult<SettingsDto> {
    let candidate = ShortcutSpec::parse(shortcut).map_err(CommandErrorDto::from)?;
    let previous = app_state_lock(&state)
        .map(|store| store.shortcut())
        .map_err(CommandErrorDto::from)?;
    lock(&state.shortcut)
        .and_then(|mut manager| manager.replace(&app_handle, &candidate))
        .map_err(CommandErrorDto::from)?;
    if let Err(error) =
        app_state_lock(&state).and_then(|mut store| store.set_shortcut(candidate.clone()))
    {
        if let Ok(mut manager) = lock(&state.shortcut) {
            manager.restore(&app_handle, previous);
        }
        return Err(CommandErrorDto::from(error));
    }
    #[cfg(target_os = "macos")]
    if let Err(error) = crate::status_item::update_shortcut(&app_handle, candidate) {
        if let Err(rollback_error) =
            app_state_lock(&state).and_then(|mut store| store.set_shortcut(previous.clone()))
        {
            log::error!("could not roll back shortcut preference: {rollback_error}");
        }
        if let Ok(mut manager) = lock(&state.shortcut) {
            manager.restore(&app_handle, previous.clone());
        }
        if let Err(rollback_error) = crate::status_item::update_shortcut(&app_handle, previous) {
            log::error!("could not restore status item shortcut: {rollback_error}");
        }
        return Err(CommandErrorDto::from(DesktopError::Window {
            operation: "update status item shortcut",
            message: error.to_string(),
        }));
    }
    log_event_result(
        "invalidate settings after shortcut update",
        emit_settings_invalidated(&app_handle),
    );
    get_settings(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn set_launch_at_login(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
    enabled: bool,
) -> CommandResult<SettingsDto> {
    if paths.is_isolated() {
        return Err(CommandErrorDto::from(DesktopError::Window {
            operation: "update Launch at Login setting",
            message: "Launch at Login is disabled in an isolated debug profile".to_owned(),
        }));
    }
    let result = if enabled {
        app_handle.autolaunch().enable()
    } else {
        app_handle.autolaunch().disable()
    };
    result
        .map_err(|error| DesktopError::Window {
            operation: "update Launch at Login setting",
            message: error.to_string(),
        })
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate settings after Launch at Login update",
        emit_settings_invalidated(&app_handle),
    );
    get_settings(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn set_onboarding_step(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    step: OnboardingStepDto,
) -> CommandResult<AppStateDto> {
    let step = match step {
        OnboardingStepDto::AddProject => OnboardingStep::AddProject,
        OnboardingStepDto::QuickCapture => OnboardingStep::QuickCapture,
        OnboardingStepDto::CodingAgents => OnboardingStep::CodingAgents,
        OnboardingStepDto::Complete => OnboardingStep::Complete,
    };
    let snapshot = app_state_lock(&state)
        .and_then(|mut store| store.set_onboarding_step(step))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate app state after onboarding update",
        emit_app_state_invalidated(&app_handle),
    );
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn get_integration_status(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<Vec<IntegrationItemDto>> {
    app_state_lock(&state)
        .map(|store| integration::status(&app_handle, &store, &paths))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn install_cli(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<Vec<IntegrationItemDto>> {
    app_state_lock(&state)
        .and_then(|mut store| integration::install_cli(&app_handle, &mut store, &paths))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate integrations after CLI install",
        emit_integrations_invalidated(&app_handle),
    );
    get_integration_status(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn uninstall_cli(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
) -> CommandResult<Vec<IntegrationItemDto>> {
    app_state_lock(&state)
        .and_then(|mut store| integration::uninstall(&mut store, IntegrationIdDto::Cli, &paths))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate integrations after CLI uninstall",
        emit_integrations_invalidated(&app_handle),
    );
    get_integration_status(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn install_agent_skill(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
    agent: IntegrationIdDto,
) -> CommandResult<Vec<IntegrationItemDto>> {
    app_state_lock(&state)
        .and_then(|mut store| {
            integration::install_agent_skill(&app_handle, &mut store, agent, &paths)
        })
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate integrations after skill install",
        emit_integrations_invalidated(&app_handle),
    );
    get_integration_status(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn uninstall_agent_skill(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    paths: State<'_, RuntimePaths>,
    agent: IntegrationIdDto,
) -> CommandResult<Vec<IntegrationItemDto>> {
    app_state_lock(&state)
        .and_then(|mut store| integration::uninstall(&mut store, agent, &paths))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate integrations after skill uninstall",
        emit_integrations_invalidated(&app_handle),
    );
    get_integration_status(app_handle, state, paths)
}

#[tauri::command]
pub(crate) fn remove_project(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    project_path: String,
    delete_sidequest_data: bool,
) -> CommandResult<AppStateDto> {
    let snapshot = app_state_lock(&state)
        .and_then(|mut store| store.remove_project(Path::new(&project_path), delete_sidequest_data))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate app state after removing project",
        emit_app_state_invalidated(&app_handle),
    );
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn set_last_selected_project(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    project_path: String,
) -> CommandResult<AppStateDto> {
    let snapshot = app_state_lock(&state)
        .and_then(|mut store| store.set_last_selected_project(Path::new(&project_path)))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate app state after selecting project",
        emit_app_state_invalidated(&app_handle),
    );
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn relocate_project(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    project_path: String,
    replacement_path: String,
) -> CommandResult<AppStateDto> {
    let snapshot = app_state_lock(&state)
        .and_then(|mut store| {
            store.relocate_project(Path::new(&project_path), Path::new(&replacement_path))
        })
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate app state after relocating project",
        emit_app_state_invalidated(&app_handle),
    );
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn set_panel_preferences(
    state: State<'_, DesktopState>,
    preferences: PanelPreferencesDto,
) -> CommandResult<PanelPreferencesDto> {
    app_state_lock(&state)
        .and_then(|mut store| store.set_panel_preferences(preferences))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn save_main_window_geometry(
    window: WebviewWindow,
    state: State<'_, DesktopState>,
) -> CommandResult<()> {
    capture_main_window(&window)
        .map_err(|error| DesktopError::Window {
            operation: "capture Main Window geometry",
            message: error.to_string(),
        })
        .and_then(|geometry| app_state_lock(&state)?.set_main_window_geometry(geometry))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn hide_main_window(app_handle: AppHandle, window: WebviewWindow) -> CommandResult<()> {
    window
        .hide()
        .map_err(|error| DesktopError::Window {
            operation: "hide Main Window",
            message: error.to_string(),
        })
        .map_err(CommandErrorDto::from)?;
    #[cfg(target_os = "macos")]
    if let Err(error) = crate::status_item::update_main_window_state(&app_handle, false, false) {
        log::warn!("status item could not track Main Window hide: {error}");
    }
    log::info!("Main Window hidden");
    Ok(())
}

#[tauri::command]
pub(crate) fn show_quick_capture(app_handle: AppHandle) -> CommandResult<()> {
    show_quick_capture_window(&app_handle).map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn focus_quick_capture(app_handle: AppHandle) -> CommandResult<()> {
    focus_quick_capture_window(&app_handle).map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn save_quick_capture_position(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
) -> CommandResult<()> {
    let window = app_handle
        .get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| DesktopError::Window {
            operation: "find Quick Capture Window",
            message: "Quick Capture Window is unavailable".to_owned(),
        })?;
    capture_quick_capture_position(&window)
        .map_err(|error| DesktopError::Window {
            operation: "capture Quick Capture Window position",
            message: error.to_string(),
        })
        .and_then(|position| app_state_lock(&state)?.set_quick_capture_position(position))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn hide_quick_capture(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
) -> CommandResult<()> {
    let position_result = save_quick_capture_position(app_handle.clone(), state);
    hide_quick_capture_window(&app_handle).map_err(CommandErrorDto::from)?;
    log::info!("Quick Capture Window hidden");
    position_result
}

#[tauri::command]
pub(crate) fn complete_app_quit(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
) -> CommandResult<()> {
    state.approve_quit();
    log::info!("React approved application quit");
    app_handle.exit(0);
    Ok(())
}

#[tauri::command]
pub(crate) fn load_workspace(project_path: String) -> CommandResult<WorkspaceSnapshotDto> {
    load_workspace_impl(Path::new(&project_path)).map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn create_quest(
    app_handle: AppHandle,
    project_path: String,
    content: String,
) -> CommandResult<QuestDto> {
    let project_path = Path::new(&project_path);
    let quest = open_exact(project_path)
        .and_then(|workspace| {
            workspace
                .create_quest(CreateQuest { content })
                .map_err(Into::into)
        })
        .map(|quest| QuestDto::from(&quest))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate workspace after creating Quest",
        emit_workspace_invalidated(&app_handle, project_path),
    );
    Ok(quest)
}

#[tauri::command]
pub(crate) fn capture_quest(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    project_path: String,
    content: String,
) -> CommandResult<QuickCaptureResultDto> {
    let (result, registered_path) = app_state_lock(&state)
        .and_then(|mut store| capture_quest_impl(&mut store, Path::new(&project_path), content))
        .map_err(CommandErrorDto::from)?;
    log_event_result(
        "invalidate workspace after Quick Capture",
        emit_workspace_invalidated(&app_handle, &registered_path),
    );
    if result.preference_warning.is_none() {
        log_event_result(
            "invalidate app state after Quick Capture",
            emit_app_state_invalidated(&app_handle),
        );
    }
    Ok(result)
}

#[tauri::command]
pub(crate) fn update_quest_content(
    project_path: String,
    id: String,
    content: String,
) -> CommandResult<QuestDto> {
    parse_quest_id(&id)
        .and_then(|id| {
            open_exact(Path::new(&project_path)).and_then(|workspace| {
                workspace
                    .update_quest_content(&id, content)
                    .map_err(Into::into)
            })
        })
        .map(|quest| QuestDto::from(&quest))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn set_quest_status(
    project_path: String,
    id: String,
    status: String,
) -> CommandResult<QuestDto> {
    parse_quest_id(&id)
        .and_then(|id| {
            let status = QuestStatus::from_str(&status)?;
            open_exact(Path::new(&project_path))
                .and_then(|workspace| workspace.set_quest_status(&id, status).map_err(Into::into))
        })
        .map(|quest| QuestDto::from(&quest))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn delete_quest(project_path: String, id: String) -> CommandResult<DeletedQuestDto> {
    parse_quest_id(&id)
        .and_then(|id| {
            open_exact(Path::new(&project_path)).and_then(|workspace| {
                workspace.delete_quest(&id).map_err(DesktopError::from)?;
                Ok(id)
            })
        })
        .map(DeletedQuestDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn search_quests(
    project_path: String,
    query: String,
) -> CommandResult<WorkspaceSnapshotDto> {
    search_workspace_impl(Path::new(&project_path), &query).map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn set_watched_project(
    app_handle: AppHandle,
    state: State<'_, DesktopState>,
    project_path: Option<String>,
) -> CommandResult<()> {
    watcher_lock(&state)
        .and_then(|mut watcher| {
            watcher.replace(&app_handle, None)?;
            let Some(project_path) = project_path else {
                return Ok(());
            };
            let workspace = open_exact(Path::new(&project_path))?;
            workspace.list_quests()?;
            watcher.replace(&app_handle, Some(workspace.root().as_path()))
        })
        .map_err(CommandErrorDto::from)
}

fn app_state_lock(state: &DesktopState) -> Result<MutexGuard<'_, AppStateStore>> {
    lock(&state.app_state)
}

fn watcher_lock(state: &DesktopState) -> Result<MutexGuard<'_, ProjectWatcher>> {
    lock(&state.watcher)
}

fn lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>> {
    mutex.lock().map_err(|_| DesktopError::StateLock)
}

fn locale_settings(preference: crate::locale::LanguagePreference) -> LocaleSettingsDto {
    LocaleSettingsDto {
        preference: preference.into(),
        effective_locale: preference.effective().into(),
    }
}

fn theme_settings(preference: crate::theme::ThemePreference) -> ThemeSettingsDto {
    ThemeSettingsDto {
        preference: preference.into(),
    }
}

fn log_event_result(operation: &'static str, result: Result<()>) {
    if let Err(error) = result {
        log::warn!("{operation} failed: {error}");
    }
}

fn parse_quest_id(id: &str) -> Result<QuestId> {
    QuestId::from_str(id).map_err(DesktopError::from)
}

fn open_exact(path: &Path) -> Result<Workspace> {
    open_workspace(path).map_err(DesktopError::from)
}

fn load_workspace_impl(path: &Path) -> Result<WorkspaceSnapshotDto> {
    let workspace = open_exact(path)?;
    let access = workspace.access()?;
    let collection = workspace.list_quests()?;
    Ok(WorkspaceSnapshotDto::from_collection(
        &workspace,
        &collection,
        access,
    ))
}

fn search_workspace_impl(path: &Path, query: &str) -> Result<WorkspaceSnapshotDto> {
    let workspace = open_exact(path)?;
    let access = workspace.access()?;
    let collection = workspace.search_quests(query)?;
    Ok(WorkspaceSnapshotDto::from_collection(
        &workspace,
        &collection,
        access,
    ))
}

fn capture_quest_impl(
    store: &mut AppStateStore,
    project_path: &Path,
    content: String,
) -> Result<(QuickCaptureResultDto, std::path::PathBuf)> {
    let registered_path = store.registered_project(project_path)?;
    let workspace = open_exact(&registered_path)?;
    let quest = workspace.create_quest(CreateQuest { content })?;
    let preference_warning = store
        .set_last_quick_capture_project(&registered_path)
        .err()
        .map(CommandErrorDto::from);
    Ok((
        QuickCaptureResultDto {
            quest: QuestDto::from(&quest),
            preference_warning,
        },
        registered_path,
    ))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use sidequest_core::{CreateQuest, QuestStatus};
    use tempfile::TempDir;

    use super::{capture_quest_impl, load_workspace_impl, search_workspace_impl};
    use crate::app_state::AppStateStore;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn workspace_helpers_should_use_real_core_data_and_isolate_issues() -> TestResult {
        let project = TempDir::new()?;
        let workspace = sidequest_core::init_workspace(project.path())?;
        workspace.create_quest(CreateQuest {
            content: "Desktop data foundation".to_owned(),
        })?;
        fs::write(
            project.path().join(".sidequest/quests/invalid-name.md"),
            "damaged",
        )?;

        let snapshot = load_workspace_impl(project.path())?;
        let search = search_workspace_impl(project.path(), "DATA")?;

        assert_eq!(snapshot.quests.len(), 1);
        assert_eq!(snapshot.issues.len(), 1);
        assert_eq!(search.quests.len(), 1);
        Ok(())
    }

    #[test]
    fn quest_writes_should_return_persisted_values() -> TestResult {
        let project = TempDir::new()?;
        let workspace = sidequest_core::init_workspace(project.path())?;
        let quest = workspace.create_quest(CreateQuest {
            content: "Original".to_owned(),
        })?;

        let updated = workspace.update_quest_content(&quest.id, "Updated".to_owned())?;
        let ready = workspace.set_quest_status(&quest.id, QuestStatus::Ready)?;

        assert_eq!(updated.content, "Updated");
        assert_eq!(ready.status, QuestStatus::Ready);
        Ok(())
    }

    #[test]
    fn load_workspace_should_never_resolve_parent_directories() -> TestResult {
        let project = TempDir::new()?;
        sidequest_core::init_workspace(project.path())?;
        let nested = project.path().join("src/nested");
        fs::create_dir_all(&nested)?;

        assert!(load_workspace_impl(&nested).is_err());
        Ok(())
    }

    #[test]
    fn quick_capture_should_require_a_registered_project_and_create_inbox() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let unregistered = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let state = store.add_project(project.path())?;

        let (result, registered_path) = capture_quest_impl(
            &mut store,
            Path::new(&state.projects[0].path),
            "Captured from Desktop".to_owned(),
        )?;

        assert_eq!(result.quest.status, "inbox");
        assert_eq!(registered_path, fs::canonicalize(project.path())?);
        assert!(result.preference_warning.is_none());
        assert!(
            capture_quest_impl(&mut store, unregistered.path(), "Not allowed".to_owned()).is_err()
        );
        Ok(())
    }
}
