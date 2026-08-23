use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sidequest_core::{WorkspaceAccess, init_workspace, open_workspace};

use crate::dto::{AppStateDto, ProjectDto, ProjectStateDto, RecoveryWarningDto, display_path};
use crate::error::{DesktopError, Result};
use crate::watcher::ProjectWatcher;

const APP_STATE_FILENAME: &str = "app.json";
const APP_STATE_SCHEMA_VERSION: u8 = 1;

pub(crate) struct DesktopState {
    pub(crate) app_state: Mutex<AppStateStore>,
    pub(crate) watcher: Mutex<ProjectWatcher>,
}

impl DesktopState {
    pub(crate) fn new(app_state: AppStateStore) -> Self {
        Self {
            app_state: Mutex::new(app_state),
            watcher: Mutex::new(ProjectWatcher::default()),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistentAppState {
    schema_version: u8,
    project_paths: Vec<PathBuf>,
    last_selected_project: Option<PathBuf>,
    recent_project_paths: Vec<PathBuf>,
}

impl Default for PersistentAppState {
    fn default() -> Self {
        Self {
            schema_version: APP_STATE_SCHEMA_VERSION,
            project_paths: Vec::new(),
            last_selected_project: None,
            recent_project_paths: Vec::new(),
        }
    }
}

pub(crate) struct AppStateStore {
    path: PathBuf,
    state: PersistentAppState,
    recovery_warning: Option<RecoveryWarningDto>,
}

impl AppStateStore {
    pub(crate) fn load(app_data_directory: &Path) -> Result<Self> {
        fs::create_dir_all(app_data_directory).map_err(|source| {
            DesktopError::io(
                "create Desktop app data directory",
                app_data_directory,
                source,
            )
        })?;
        let directory = fs::canonicalize(app_data_directory).map_err(|source| {
            DesktopError::io(
                "canonicalize Desktop app data directory",
                app_data_directory,
                source,
            )
        })?;
        let path = directory.join(APP_STATE_FILENAME);

        if !path.exists() {
            let state = PersistentAppState::default();
            write_atomic_state(&path, &state)?;
            return Ok(Self {
                path,
                state,
                recovery_warning: None,
            });
        }

        let bytes = fs::read(&path)
            .map_err(|source| DesktopError::io("read Desktop state", &path, source))?;
        match serde_json::from_slice::<PersistentAppState>(&bytes) {
            Ok(state) if state.schema_version == APP_STATE_SCHEMA_VERSION => Ok(Self {
                path,
                state: normalize_state(state),
                recovery_warning: None,
            }),
            Ok(state) => Self::recover_invalid(
                path,
                format!("unsupported schema version: {}", state.schema_version),
            ),
            Err(source) => Self::recover_invalid(path, source.to_string()),
        }
    }

    fn recover_invalid(path: PathBuf, reason: String) -> Result<Self> {
        let backup_path = quarantine_path(&path);
        fs::rename(&path, &backup_path).map_err(|source| {
            DesktopError::io("quarantine invalid Desktop state", &path, source)
        })?;
        let parent = path.parent().ok_or_else(|| DesktopError::InvalidAppState {
            path: path.clone(),
            message: "Desktop state path has no parent directory".to_owned(),
        })?;
        sync_directory(parent)?;

        let state = PersistentAppState::default();
        write_atomic_state(&path, &state)?;
        Ok(Self {
            recovery_warning: Some(RecoveryWarningDto {
                message: format!("Desktop state was reset because app.json was invalid: {reason}"),
                path: display_path(&path),
                backup_path: display_path(&backup_path),
            }),
            path,
            state,
        })
    }

    pub(crate) fn snapshot(&self) -> AppStateDto {
        AppStateDto {
            projects: self
                .state
                .project_paths
                .iter()
                .map(|path| project_dto(path))
                .collect(),
            last_selected_project: self
                .state
                .last_selected_project
                .as_deref()
                .map(display_path),
            recovery_warning: self.recovery_warning.clone(),
        }
    }

    pub(crate) fn add_project(&mut self, project_path: &Path) -> Result<AppStateDto> {
        let workspace = init_workspace(project_path)?;
        let path = workspace.root().as_path().to_path_buf();
        let mut next = self.state.clone();
        if !next.project_paths.contains(&path) {
            next.project_paths.push(path.clone());
        }
        mark_recent(&mut next, &path);
        next.last_selected_project = Some(path);
        self.persist(next)?;
        Ok(self.snapshot())
    }

    pub(crate) fn set_last_selected_project(&mut self, path: &Path) -> Result<AppStateDto> {
        if !self
            .state
            .project_paths
            .iter()
            .any(|project| project == path)
        {
            return Err(DesktopError::ProjectNotFound {
                path: path.to_path_buf(),
            });
        }

        let mut next = self.state.clone();
        mark_recent(&mut next, path);
        next.last_selected_project = Some(path.to_path_buf());
        self.persist(next)?;
        Ok(self.snapshot())
    }

    pub(crate) fn remove_project(
        &mut self,
        path: &Path,
        delete_sidequest_data: bool,
    ) -> Result<AppStateDto> {
        if !self
            .state
            .project_paths
            .iter()
            .any(|project| project == path)
        {
            return Err(DesktopError::ProjectNotFound {
                path: path.to_path_buf(),
            });
        }
        if delete_sidequest_data {
            open_workspace(path)?.delete_sidequest_data()?;
        }

        let mut next = self.state.clone();
        next.project_paths.retain(|project| project != path);
        next.recent_project_paths.retain(|project| project != path);
        if next.last_selected_project.as_deref() == Some(path) {
            next.last_selected_project = next
                .recent_project_paths
                .iter()
                .find(|recent| next.project_paths.contains(recent))
                .cloned()
                .or_else(|| next.project_paths.first().cloned());
        }
        self.persist(next)?;
        Ok(self.snapshot())
    }

    fn persist(&mut self, next: PersistentAppState) -> Result<()> {
        write_atomic_state(&self.path, &next)?;
        self.state = next;
        Ok(())
    }
}

fn normalize_state(mut state: PersistentAppState) -> PersistentAppState {
    let mut unique_projects = Vec::with_capacity(state.project_paths.len());
    for path in state.project_paths {
        if !unique_projects.contains(&path) {
            unique_projects.push(path);
        }
    }
    state.project_paths = unique_projects;
    let mut unique_recent = Vec::with_capacity(state.recent_project_paths.len());
    for path in state.recent_project_paths {
        if state.project_paths.contains(&path) && !unique_recent.contains(&path) {
            unique_recent.push(path);
        }
    }
    state.recent_project_paths = unique_recent;
    if state
        .last_selected_project
        .as_ref()
        .is_some_and(|path| !state.project_paths.contains(path))
    {
        state.last_selected_project = None;
    }
    state
}

fn mark_recent(state: &mut PersistentAppState, path: &Path) {
    state.recent_project_paths.retain(|recent| recent != path);
    state.recent_project_paths.insert(0, path.to_path_buf());
}

fn project_dto(path: &Path) -> ProjectDto {
    let state = open_workspace(path)
        .and_then(|workspace| workspace.access())
        .map_or(ProjectStateDto::Unavailable, |access| match access {
            WorkspaceAccess::Writable => ProjectStateDto::Writable,
            WorkspaceAccess::ReadOnly => ProjectStateDto::ReadOnly,
        });
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map_or_else(|| display_path(path), str::to_owned);
    ProjectDto {
        path: display_path(path),
        name,
        state,
    }
}

fn quarantine_path(path: &Path) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis());
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    for suffix in 0..=u16::MAX {
        let filename = if suffix == 0 {
            format!("app.corrupt-{timestamp}.json")
        } else {
            format!("app.corrupt-{timestamp}-{suffix}.json")
        };
        let candidate = parent.join(filename);
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("app.corrupt-{timestamp}-overflow.json"))
}

fn write_atomic_state(path: &Path, state: &PersistentAppState) -> Result<()> {
    let parent = path.parent().ok_or_else(|| DesktopError::InvalidAppState {
        path: path.to_path_buf(),
        message: "Desktop state path has no parent directory".to_owned(),
    })?;
    let mut bytes =
        serde_json::to_vec_pretty(state).map_err(|source| DesktopError::InvalidAppState {
            path: path.to_path_buf(),
            message: source.to_string(),
        })?;
    bytes.push(b'\n');

    for attempt in 0..16 {
        let temporary_path = parent.join(format!(".app.json.{}.tmp", unique_suffix(attempt)));
        let file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary_path);
        let mut file = match file {
            Ok(file) => file,
            Err(source) if source.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(source) => {
                return Err(DesktopError::io(
                    "create temporary Desktop state",
                    temporary_path,
                    source,
                ));
            }
        };

        let result = (|| {
            file.write_all(&bytes).map_err(|source| {
                DesktopError::io("write temporary Desktop state", &temporary_path, source)
            })?;
            file.flush().map_err(|source| {
                DesktopError::io("flush temporary Desktop state", &temporary_path, source)
            })?;
            file.sync_all().map_err(|source| {
                DesktopError::io("sync temporary Desktop state", &temporary_path, source)
            })?;
            drop(file);
            fs::rename(&temporary_path, path)
                .map_err(|source| DesktopError::io("replace Desktop state", path, source))?;
            sync_directory(parent)
        })();
        if result.is_err() {
            let _cleanup_result = fs::remove_file(&temporary_path);
        }
        return result;
    }

    Err(DesktopError::io(
        "create temporary Desktop state",
        path,
        io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique temporary Desktop state filename",
        ),
    ))
}

fn unique_suffix(attempt: u8) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    format!("{}-{nanos}-{attempt}", std::process::id())
}

fn sync_directory(path: &Path) -> Result<()> {
    let directory = File::open(path)
        .map_err(|source| DesktopError::io("open Desktop state directory", path, source))?;
    directory
        .sync_all()
        .map_err(|source| DesktopError::io("sync Desktop state directory", path, source))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use sidequest_core::open_workspace;
    use tempfile::TempDir;

    use super::{AppStateStore, PersistentAppState};

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn load_should_create_and_restore_default_state() -> TestResult {
        let temporary = TempDir::new()?;

        let first = AppStateStore::load(temporary.path())?;
        let second = AppStateStore::load(temporary.path())?;

        assert!(temporary.path().join("app.json").is_file());
        assert!(first.snapshot().projects.is_empty());
        assert!(second.snapshot().projects.is_empty());
        Ok(())
    }

    #[test]
    fn load_should_quarantine_invalid_json_and_recover_empty_state() -> TestResult {
        let temporary = TempDir::new()?;
        fs::write(temporary.path().join("app.json"), "damaged")?;

        let store = AppStateStore::load(temporary.path())?;
        let backup = store
            .snapshot()
            .recovery_warning
            .ok_or("missing recovery warning")?
            .backup_path;

        assert!(std::path::Path::new(&backup).is_file());
        assert!(store.snapshot().projects.is_empty());
        Ok(())
    }

    #[test]
    fn load_should_quarantine_unknown_schema_version() -> TestResult {
        let temporary = TempDir::new()?;
        let state = PersistentAppState {
            schema_version: 2,
            ..PersistentAppState::default()
        };
        fs::write(
            temporary.path().join("app.json"),
            serde_json::to_vec(&state)?,
        )?;

        let store = AppStateStore::load(temporary.path())?;

        assert!(store.snapshot().recovery_warning.is_some());
        Ok(())
    }

    #[test]
    fn add_should_initialize_deduplicate_and_restore_projects() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;

        store.add_project(project.path())?;
        store.add_project(project.path())?;
        let restored = AppStateStore::load(data.path())?;

        assert_eq!(restored.snapshot().projects.len(), 1);
        assert_eq!(
            restored.snapshot().last_selected_project,
            Some(
                fs::canonicalize(project.path())?
                    .to_string_lossy()
                    .into_owned()
            )
        );
        Ok(())
    }

    #[test]
    fn add_should_keep_nested_directories_as_independent_projects() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let nested = project.path().join("nested");
        fs::create_dir(&nested)?;
        let mut store = AppStateStore::load(data.path())?;

        store.add_project(project.path())?;
        let state = store.add_project(&nested)?;

        assert_eq!(state.projects.len(), 2);
        assert!(project.path().join(".sidequest").is_dir());
        assert!(nested.join(".sidequest").is_dir());
        Ok(())
    }

    #[test]
    fn remove_should_preserve_project_data_by_default() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let state = store.add_project(project.path())?;
        let path = std::path::PathBuf::from(&state.projects[0].path);

        let state = store.remove_project(&path, false)?;

        assert!(state.projects.is_empty());
        assert!(project.path().join(".sidequest").is_dir());
        Ok(())
    }

    #[test]
    fn remove_with_delete_should_preserve_project_root() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let state = store.add_project(project.path())?;
        let path = std::path::PathBuf::from(&state.projects[0].path);

        let state = store.remove_project(&path, true)?;

        assert!(state.projects.is_empty());
        assert!(project.path().is_dir());
        assert!(open_workspace(project.path()).is_err());
        Ok(())
    }

    #[test]
    fn writes_should_not_leave_temporary_state_files() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;

        store.add_project(project.path())?;

        let temporary_files = fs::read_dir(data.path())?
            .filter_map(std::result::Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .count();
        assert_eq!(temporary_files, 0);
        Ok(())
    }

    #[test]
    fn remove_selected_project_should_restore_the_most_recent_remaining_project() -> TestResult {
        let data = TempDir::new()?;
        let first = TempDir::new()?;
        let second = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let first_path = fs::canonicalize(first.path())?;
        let second_path = fs::canonicalize(second.path())?;
        store.add_project(&first_path)?;
        store.add_project(&second_path)?;
        store.set_last_selected_project(&first_path)?;

        let state = store.remove_project(&first_path, false)?;

        assert_eq!(
            state.last_selected_project,
            Some(second_path.to_string_lossy().into_owned())
        );
        Ok(())
    }

    #[test]
    fn missing_project_should_remain_registered_as_unavailable() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let moved = project.path().with_extension("moved");
        let mut store = AppStateStore::load(data.path())?;
        store.add_project(project.path())?;
        fs::rename(project.path(), &moved)?;

        let state = store.snapshot();

        assert_eq!(state.projects[0].state, super::ProjectStateDto::Unavailable);
        fs::rename(&moved, project.path())?;
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn read_only_project_should_remain_browsable_in_app_state() -> TestResult {
        use std::os::unix::fs::PermissionsExt;

        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        store.add_project(project.path())?;
        let quests = project.path().join(".sidequest/quests");
        let original_permissions = fs::metadata(&quests)?.permissions();
        fs::set_permissions(&quests, fs::Permissions::from_mode(0o555))?;

        let state = store.snapshot();
        fs::set_permissions(&quests, original_permissions)?;

        assert_eq!(state.projects[0].state, super::ProjectStateDto::ReadOnly);
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn failed_sidequest_deletion_should_keep_the_project_record() -> TestResult {
        use std::os::unix::fs::symlink;

        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let external = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let state = store.add_project(project.path())?;
        let project_path = std::path::PathBuf::from(&state.projects[0].path);
        let sidequest = project.path().join(".sidequest");
        fs::rename(&sidequest, project.path().join("original-sidequest"))?;
        symlink(external.path(), &sidequest)?;

        assert!(store.remove_project(&project_path, true).is_err());
        assert_eq!(store.snapshot().projects.len(), 1);
        Ok(())
    }
}
