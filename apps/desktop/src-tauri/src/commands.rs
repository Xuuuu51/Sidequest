use std::path::Path;
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};

use sidequest_core::{CreateQuest, QuestId, QuestStatus, Workspace, open_workspace};
use tauri::{AppHandle, State};

use crate::app_state::{AppStateStore, DesktopState};
use crate::dto::{AppStateDto, CommandErrorDto, DeletedQuestDto, QuestDto, WorkspaceSnapshotDto};
use crate::error::{DesktopError, Result};
use crate::watcher::ProjectWatcher;

type CommandResult<T> = std::result::Result<T, CommandErrorDto>;

#[tauri::command]
pub(crate) fn get_app_state(state: State<'_, DesktopState>) -> CommandResult<AppStateDto> {
    app_state_lock(&state)
        .map(|store| store.snapshot())
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn add_project(
    state: State<'_, DesktopState>,
    project_path: String,
) -> CommandResult<AppStateDto> {
    app_state_lock(&state)
        .and_then(|mut store| store.add_project(Path::new(&project_path)))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn remove_project(
    state: State<'_, DesktopState>,
    project_path: String,
    delete_sidequest_data: bool,
) -> CommandResult<AppStateDto> {
    app_state_lock(&state)
        .and_then(|mut store| store.remove_project(Path::new(&project_path), delete_sidequest_data))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn set_last_selected_project(
    state: State<'_, DesktopState>,
    project_path: String,
) -> CommandResult<AppStateDto> {
    app_state_lock(&state)
        .and_then(|mut store| store.set_last_selected_project(Path::new(&project_path)))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn load_workspace(project_path: String) -> CommandResult<WorkspaceSnapshotDto> {
    load_workspace_impl(Path::new(&project_path)).map_err(CommandErrorDto::from)
}

#[tauri::command]
pub(crate) fn create_quest(project_path: String, content: String) -> CommandResult<QuestDto> {
    open_exact(Path::new(&project_path))
        .and_then(|workspace| {
            workspace
                .create_quest(CreateQuest { content })
                .map_err(Into::into)
        })
        .map(|quest| QuestDto::from(&quest))
        .map_err(CommandErrorDto::from)
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

#[cfg(test)]
mod tests {
    use std::fs;

    use sidequest_core::{CreateQuest, QuestStatus};
    use tempfile::TempDir;

    use super::{load_workspace_impl, search_workspace_impl};

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
}
