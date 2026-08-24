use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sidequest_core::{WorkspaceAccess, init_workspace, open_workspace};

use crate::dto::{
    AppStateDto, OnboardingStepDto, PanelPreferencesDto, ProjectDto, ProjectStateDto,
    QuickCapturePositionDto, QuickCapturePreferencesDto, RecoveryWarningDto, display_path,
};
use crate::error::{DesktopError, Result};
use crate::locale::LanguagePreference;
use crate::shortcut::{ShortcutManager, ShortcutSpec};
use crate::theme::ThemePreference;
use crate::watcher::ProjectWatcher;

const APP_STATE_FILENAME: &str = "app.json";
pub(crate) const APP_STATE_SCHEMA_VERSION: u8 = 1;
pub(crate) const DEFAULT_SIDEBAR_WIDTH: u16 = 224;
pub(crate) const MIN_SIDEBAR_WIDTH: u16 = 180;
pub(crate) const MAX_SIDEBAR_WIDTH: u16 = 320;
pub(crate) const DEFAULT_DRAWER_WIDTH: u16 = 480;
pub(crate) const MIN_DRAWER_WIDTH: u16 = 420;
pub(crate) const MAX_DRAWER_WIDTH: u16 = 560;
pub(crate) const DEFAULT_WINDOW_WIDTH: u32 = 1280;
pub(crate) const DEFAULT_WINDOW_HEIGHT: u32 = 800;
pub(crate) const MIN_WINDOW_WIDTH: u32 = 1024;
pub(crate) const MIN_WINDOW_HEIGHT: u32 = 640;

pub(crate) struct DesktopState {
    pub(crate) app_state: Mutex<AppStateStore>,
    pub(crate) watcher: Mutex<ProjectWatcher>,
    pub(crate) shortcut: Mutex<ShortcutManager>,
    quit_approved: AtomicBool,
}

impl DesktopState {
    pub(crate) fn new(app_state: AppStateStore, shortcut: ShortcutManager) -> Self {
        Self {
            app_state: Mutex::new(app_state),
            watcher: Mutex::new(ProjectWatcher::default()),
            shortcut: Mutex::new(shortcut),
            quit_approved: AtomicBool::new(false),
        }
    }

    pub(crate) fn approve_quit(&self) {
        self.quit_approved.store(true, Ordering::SeqCst);
    }

    pub(crate) fn consume_quit_approval(&self) -> bool {
        self.quit_approved.swap(false, Ordering::SeqCst)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistentAppState {
    schema_version: u8,
    project_paths: Vec<PathBuf>,
    last_selected_project: Option<PathBuf>,
    recent_project_paths: Vec<PathBuf>,
    #[serde(default)]
    panel_preferences: PanelPreferences,
    #[serde(default)]
    main_window: Option<MainWindowGeometry>,
    #[serde(default)]
    quick_capture: QuickCapturePreferences,
    #[serde(default)]
    onboarding_step: OnboardingStep,
    #[serde(default)]
    shortcut: ShortcutSpec,
    #[serde(default)]
    integrations: IntegrationPreferences,
    #[serde(default)]
    language_preference: LanguagePreference,
    #[serde(default)]
    theme_preference: ThemePreference,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum OnboardingStep {
    #[default]
    AddProject,
    QuickCapture,
    CodingAgents,
    Complete,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct IntegrationPreferences {
    cli_user_uninstalled: bool,
    cli: Option<ManagedArtifactRecord>,
    codex: Option<ManagedArtifactRecord>,
    claude: Option<ManagedArtifactRecord>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ManagedArtifactRecord {
    pub(crate) path: PathBuf,
    pub(crate) version: String,
    pub(crate) sha256: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ManagedArtifact {
    Cli,
    Codex,
    Claude,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickCapturePreferences {
    last_project_path: Option<PathBuf>,
    position: Option<QuickCapturePosition>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickCapturePosition {
    pub(crate) x: i32,
    pub(crate) y: i32,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelPreferences {
    sidebar_width: u16,
    sidebar_collapsed: bool,
    drawer_width: u16,
}

impl Default for PanelPreferences {
    fn default() -> Self {
        Self {
            sidebar_width: DEFAULT_SIDEBAR_WIDTH,
            sidebar_collapsed: false,
            drawer_width: DEFAULT_DRAWER_WIDTH,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MainWindowGeometry {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) maximized: bool,
}

impl Default for PersistentAppState {
    fn default() -> Self {
        Self {
            schema_version: APP_STATE_SCHEMA_VERSION,
            project_paths: Vec::new(),
            last_selected_project: None,
            recent_project_paths: Vec::new(),
            panel_preferences: PanelPreferences::default(),
            main_window: None,
            quick_capture: QuickCapturePreferences::default(),
            onboarding_step: OnboardingStep::default(),
            shortcut: ShortcutSpec::default(),
            integrations: IntegrationPreferences::default(),
            language_preference: LanguagePreference::default(),
            theme_preference: ThemePreference::default(),
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
            panel_preferences: self.state.panel_preferences.into(),
            quick_capture: QuickCapturePreferencesDto {
                last_project_path: self
                    .preferred_quick_capture_project()
                    .as_deref()
                    .map(display_path),
                position: self.state.quick_capture.position.map(Into::into),
            },
            onboarding_step: self.state.onboarding_step.into(),
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
        if next.onboarding_step == OnboardingStep::AddProject {
            next.onboarding_step = OnboardingStep::QuickCapture;
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

    pub(crate) fn relocate_project(
        &mut self,
        current_path: &Path,
        replacement_path: &Path,
    ) -> Result<AppStateDto> {
        let current_index = self
            .state
            .project_paths
            .iter()
            .position(|project| project == current_path)
            .ok_or_else(|| DesktopError::ProjectNotFound {
                path: current_path.to_path_buf(),
            })?;
        let workspace = open_workspace(replacement_path)?;
        let replacement = workspace.root().as_path().to_path_buf();
        let mut next = self.state.clone();

        if replacement == current_path {
            mark_recent(&mut next, &replacement);
            next.last_selected_project = Some(replacement);
            self.persist(next)?;
            return Ok(self.snapshot());
        }
        next.recent_project_paths
            .retain(|recent| recent != current_path);
        if next.quick_capture.last_project_path.as_deref() == Some(current_path) {
            next.quick_capture.last_project_path = Some(replacement.clone());
        }

        if let Some(existing_index) = next
            .project_paths
            .iter()
            .position(|project| project == &replacement)
        {
            next.project_paths.remove(current_index);
            let adjusted_index = if current_index < existing_index {
                existing_index - 1
            } else {
                existing_index
            };
            let selected = next.project_paths[adjusted_index].clone();
            mark_recent(&mut next, &selected);
            next.last_selected_project = Some(selected);
        } else {
            next.project_paths[current_index] = replacement.clone();
            mark_recent(&mut next, &replacement);
            next.last_selected_project = Some(replacement);
        }

        self.persist(next)?;
        Ok(self.snapshot())
    }

    pub(crate) fn set_panel_preferences(
        &mut self,
        preferences: PanelPreferencesDto,
    ) -> Result<PanelPreferencesDto> {
        let mut next = self.state.clone();
        next.panel_preferences = PanelPreferences {
            sidebar_width: preferences
                .sidebar_width
                .clamp(MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
            sidebar_collapsed: preferences.sidebar_collapsed,
            drawer_width: preferences
                .drawer_width
                .clamp(MIN_DRAWER_WIDTH, MAX_DRAWER_WIDTH),
        };
        let persisted = next.panel_preferences;
        self.persist(next)?;
        Ok(persisted.into())
    }

    pub(crate) fn main_window_geometry(&self) -> Option<MainWindowGeometry> {
        self.state.main_window
    }

    pub(crate) fn set_main_window_geometry(&mut self, geometry: MainWindowGeometry) -> Result<()> {
        let mut next = self.state.clone();
        next.main_window = Some(MainWindowGeometry {
            width: geometry.width.max(MIN_WINDOW_WIDTH),
            height: geometry.height.max(MIN_WINDOW_HEIGHT),
            ..geometry
        });
        self.persist(next)
    }

    pub(crate) fn quick_capture_position(&self) -> Option<QuickCapturePosition> {
        self.state.quick_capture.position
    }

    pub(crate) fn set_quick_capture_position(
        &mut self,
        position: QuickCapturePosition,
    ) -> Result<()> {
        let mut next = self.state.clone();
        next.quick_capture.position = Some(position);
        self.persist(next)
    }

    pub(crate) fn registered_project(&self, path: &Path) -> Result<PathBuf> {
        self.state
            .project_paths
            .iter()
            .find(|project| project.as_path() == path)
            .cloned()
            .ok_or_else(|| DesktopError::ProjectNotFound {
                path: path.to_path_buf(),
            })
    }

    pub(crate) fn has_projects(&self) -> bool {
        !self.state.project_paths.is_empty()
    }

    pub(crate) fn shortcut(&self) -> ShortcutSpec {
        self.state.shortcut.clone()
    }

    pub(crate) const fn language_preference(&self) -> LanguagePreference {
        self.state.language_preference
    }

    pub(crate) fn set_language_preference(&mut self, preference: LanguagePreference) -> Result<()> {
        let mut next = self.state.clone();
        next.language_preference = preference;
        self.persist(next)
    }

    pub(crate) const fn theme_preference(&self) -> ThemePreference {
        self.state.theme_preference
    }

    pub(crate) fn set_theme_preference(&mut self, preference: ThemePreference) -> Result<()> {
        let mut next = self.state.clone();
        next.theme_preference = preference;
        self.persist(next)
    }

    pub(crate) fn set_shortcut(&mut self, shortcut: ShortcutSpec) -> Result<()> {
        let mut next = self.state.clone();
        next.shortcut = shortcut;
        self.persist(next)
    }

    pub(crate) fn set_onboarding_step(&mut self, step: OnboardingStep) -> Result<AppStateDto> {
        let mut next = self.state.clone();
        next.onboarding_step = step;
        self.persist(next)?;
        Ok(self.snapshot())
    }

    pub(crate) fn integration_record(
        &self,
        artifact: ManagedArtifact,
    ) -> Option<ManagedArtifactRecord> {
        match artifact {
            ManagedArtifact::Cli => &self.state.integrations.cli,
            ManagedArtifact::Codex => &self.state.integrations.codex,
            ManagedArtifact::Claude => &self.state.integrations.claude,
        }
        .clone()
    }

    pub(crate) fn cli_user_uninstalled(&self) -> bool {
        self.state.integrations.cli_user_uninstalled
    }

    pub(crate) fn set_integration_record(
        &mut self,
        artifact: ManagedArtifact,
        record: Option<ManagedArtifactRecord>,
        cli_user_uninstalled: Option<bool>,
    ) -> Result<()> {
        let mut next = self.state.clone();
        match artifact {
            ManagedArtifact::Cli => next.integrations.cli = record,
            ManagedArtifact::Codex => next.integrations.codex = record,
            ManagedArtifact::Claude => next.integrations.claude = record,
        }
        if let Some(uninstalled) = cli_user_uninstalled {
            next.integrations.cli_user_uninstalled = uninstalled;
        }
        self.persist(next)
    }

    pub(crate) fn set_last_quick_capture_project(&mut self, path: &Path) -> Result<()> {
        let project = self.registered_project(path)?;
        let mut next = self.state.clone();
        next.quick_capture.last_project_path = Some(project);
        self.persist(next)
    }

    fn preferred_quick_capture_project(&self) -> Option<PathBuf> {
        self.state
            .quick_capture
            .last_project_path
            .as_ref()
            .filter(|path| self.state.project_paths.contains(path))
            .or_else(|| {
                self.state
                    .last_selected_project
                    .as_ref()
                    .filter(|path| self.state.project_paths.contains(path))
            })
            .or_else(|| self.state.project_paths.first())
            .cloned()
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
        if next.quick_capture.last_project_path.as_deref() == Some(path) {
            next.quick_capture.last_project_path = None;
        }
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
    if !state.project_paths.is_empty() && state.onboarding_step == OnboardingStep::AddProject {
        state.onboarding_step = OnboardingStep::QuickCapture;
    }
    state.panel_preferences.sidebar_width = state
        .panel_preferences
        .sidebar_width
        .clamp(MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
    state.panel_preferences.drawer_width = state
        .panel_preferences
        .drawer_width
        .clamp(MIN_DRAWER_WIDTH, MAX_DRAWER_WIDTH);
    if let Some(geometry) = &mut state.main_window {
        geometry.width = geometry.width.max(MIN_WINDOW_WIDTH);
        geometry.height = geometry.height.max(MIN_WINDOW_HEIGHT);
    }
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
    if state
        .quick_capture
        .last_project_path
        .as_ref()
        .is_some_and(|path| !state.project_paths.contains(path))
    {
        state.quick_capture.last_project_path = None;
    }
    state
}

impl From<OnboardingStep> for OnboardingStepDto {
    fn from(step: OnboardingStep) -> Self {
        match step {
            OnboardingStep::AddProject => Self::AddProject,
            OnboardingStep::QuickCapture => Self::QuickCapture,
            OnboardingStep::CodingAgents => Self::CodingAgents,
            OnboardingStep::Complete => Self::Complete,
        }
    }
}

impl From<QuickCapturePosition> for QuickCapturePositionDto {
    fn from(position: QuickCapturePosition) -> Self {
        Self {
            x: position.x,
            y: position.y,
        }
    }
}

impl From<PanelPreferences> for PanelPreferencesDto {
    fn from(preferences: PanelPreferences) -> Self {
        Self {
            sidebar_width: preferences.sidebar_width,
            sidebar_collapsed: preferences.sidebar_collapsed,
            drawer_width: preferences.drawer_width,
        }
    }
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
        if result.is_err()
            && let Err(cleanup_error) = fs::remove_file(&temporary_path)
            && cleanup_error.kind() != io::ErrorKind::NotFound
        {
            log::warn!("could not clean temporary Desktop state: {cleanup_error}");
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
    use std::path::PathBuf;

    use sidequest_core::open_workspace;
    use tempfile::TempDir;

    use super::{
        AppStateStore, DEFAULT_DRAWER_WIDTH, DEFAULT_SIDEBAR_WIDTH, DesktopState, MAX_DRAWER_WIDTH,
        MAX_SIDEBAR_WIDTH, MainWindowGeometry, PersistentAppState, QuickCapturePosition,
    };
    use crate::dto::PanelPreferencesDto;
    use crate::locale::LanguagePreference;
    use crate::theme::ThemePreference;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn quit_approval_should_be_consumed_once() -> TestResult {
        let temporary = TempDir::new()?;
        let state = DesktopState::new(
            AppStateStore::load(temporary.path())?,
            crate::shortcut::ShortcutManager::unregistered(crate::shortcut::ShortcutSpec::default()),
        );

        assert!(!state.consume_quit_approval());
        state.approve_quit();
        assert!(state.consume_quit_approval());
        assert!(!state.consume_quit_approval());
        Ok(())
    }

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
    fn legacy_state_without_stage_four_fields_should_use_defaults() -> TestResult {
        let temporary = TempDir::new()?;
        fs::write(
            temporary.path().join("app.json"),
            r#"{
  "schemaVersion": 1,
  "projectPaths": [],
  "lastSelectedProject": null,
  "recentProjectPaths": []
}"#,
        )?;

        let store = AppStateStore::load(temporary.path())?;
        let state = store.snapshot();

        assert!(state.recovery_warning.is_none());
        assert_eq!(state.panel_preferences.sidebar_width, DEFAULT_SIDEBAR_WIDTH);
        assert_eq!(state.panel_preferences.drawer_width, DEFAULT_DRAWER_WIDTH);
        assert!(store.main_window_geometry().is_none());
        assert!(state.quick_capture.last_project_path.is_none());
        assert!(state.quick_capture.position.is_none());
        assert_eq!(store.language_preference(), LanguagePreference::System);
        assert_eq!(store.theme_preference(), ThemePreference::System);
        Ok(())
    }

    #[test]
    fn language_preference_should_persist_and_restore() -> TestResult {
        let temporary = TempDir::new()?;
        let mut store = AppStateStore::load(temporary.path())?;

        store.set_language_preference(LanguagePreference::SimplifiedChinese)?;
        let restored = AppStateStore::load(temporary.path())?;

        assert_eq!(
            restored.language_preference(),
            LanguagePreference::SimplifiedChinese
        );
        Ok(())
    }

    #[test]
    fn theme_preference_should_persist_and_restore() -> TestResult {
        let temporary = TempDir::new()?;
        let mut store = AppStateStore::load(temporary.path())?;

        for preference in [
            ThemePreference::Light,
            ThemePreference::Dark,
            ThemePreference::System,
        ] {
            store.set_theme_preference(preference)?;
            let restored = AppStateStore::load(temporary.path())?;
            assert_eq!(restored.theme_preference(), preference);
        }
        Ok(())
    }

    #[test]
    fn legacy_state_with_a_project_should_resume_remaining_onboarding() -> TestResult {
        let temporary = TempDir::new()?;
        let project = TempDir::new()?;
        sidequest_core::init_workspace(project.path())?;
        let project_path = fs::canonicalize(project.path())?;
        fs::write(
            temporary.path().join("app.json"),
            serde_json::json!({
                "schemaVersion": 1,
                "projectPaths": [project_path],
                "lastSelectedProject": project_path,
                "recentProjectPaths": [project_path]
            })
            .to_string(),
        )?;

        let state = AppStateStore::load(temporary.path())?.snapshot();

        assert_eq!(
            state.onboarding_step,
            crate::dto::OnboardingStepDto::QuickCapture
        );
        Ok(())
    }

    #[test]
    fn quick_capture_preferences_should_persist_and_restore() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let state = store.add_project(project.path())?;
        let project_path = PathBuf::from(&state.projects[0].path);

        store.set_last_quick_capture_project(&project_path)?;
        store.set_quick_capture_position(QuickCapturePosition { x: 80, y: 640 })?;
        let restored = AppStateStore::load(data.path())?.snapshot();

        assert_eq!(
            restored.quick_capture.last_project_path,
            Some(project_path.to_string_lossy().into_owned())
        );
        assert_eq!(
            restored.quick_capture.position,
            Some(crate::dto::QuickCapturePositionDto { x: 80, y: 640 })
        );
        Ok(())
    }

    #[test]
    fn quick_capture_project_should_fall_back_after_removal() -> TestResult {
        let data = TempDir::new()?;
        let first = TempDir::new()?;
        let second = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let first_path = fs::canonicalize(first.path())?;
        let second_path = fs::canonicalize(second.path())?;
        store.add_project(&first_path)?;
        store.add_project(&second_path)?;
        store.set_last_quick_capture_project(&second_path)?;
        store.set_last_selected_project(&first_path)?;

        let state = store.remove_project(&second_path, false)?;

        assert_eq!(
            state.quick_capture.last_project_path,
            Some(first_path.to_string_lossy().into_owned())
        );
        Ok(())
    }

    #[test]
    fn panel_preferences_should_clamp_and_restore() -> TestResult {
        let temporary = TempDir::new()?;
        let mut store = AppStateStore::load(temporary.path())?;

        let preferences = store.set_panel_preferences(PanelPreferencesDto {
            sidebar_width: u16::MAX,
            sidebar_collapsed: true,
            drawer_width: u16::MAX,
        })?;
        let restored = AppStateStore::load(temporary.path())?.snapshot();

        assert_eq!(preferences.sidebar_width, MAX_SIDEBAR_WIDTH);
        assert_eq!(preferences.drawer_width, MAX_DRAWER_WIDTH);
        assert!(restored.panel_preferences.sidebar_collapsed);
        assert_eq!(restored.panel_preferences, preferences);
        Ok(())
    }

    #[test]
    fn main_window_geometry_should_persist_with_minimum_size() -> TestResult {
        let temporary = TempDir::new()?;
        let mut store = AppStateStore::load(temporary.path())?;

        store.set_main_window_geometry(MainWindowGeometry {
            x: 50,
            y: 60,
            width: 100,
            height: 100,
            maximized: true,
        })?;
        let geometry = AppStateStore::load(temporary.path())?
            .main_window_geometry()
            .ok_or("missing Main Window geometry")?;

        assert_eq!(geometry.x, 50);
        assert_eq!(geometry.y, 60);
        assert_eq!(geometry.width, super::MIN_WINDOW_WIDTH);
        assert_eq!(geometry.height, super::MIN_WINDOW_HEIGHT);
        assert!(geometry.maximized);
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

    #[test]
    fn relocate_should_replace_the_missing_project_and_preserve_its_position() -> TestResult {
        let data = TempDir::new()?;
        let first = TempDir::new()?;
        let moving = TempDir::new()?;
        let replacement = moving.path().with_extension("relocated");
        let mut store = AppStateStore::load(data.path())?;
        store.add_project(first.path())?;
        let state = store.add_project(moving.path())?;
        let old_path = PathBuf::from(&state.projects[1].path);
        fs::rename(moving.path(), &replacement)?;

        let relocated = store.relocate_project(&old_path, &replacement)?;

        assert_eq!(relocated.projects.len(), 2);
        assert_eq!(
            relocated.projects[0].path,
            fs::canonicalize(first.path())?.to_string_lossy()
        );
        assert_eq!(
            relocated.projects[1].path,
            fs::canonicalize(&replacement)?.to_string_lossy()
        );
        assert_eq!(
            relocated.last_selected_project,
            Some(relocated.projects[1].path.clone())
        );
        fs::rename(&replacement, moving.path())?;
        Ok(())
    }

    #[test]
    fn relocate_to_an_existing_project_should_remove_the_stale_record() -> TestResult {
        let data = TempDir::new()?;
        let stale = TempDir::new()?;
        let existing = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let stale_state = store.add_project(stale.path())?;
        let stale_path = PathBuf::from(&stale_state.projects[0].path);
        let existing_state = store.add_project(existing.path())?;
        let existing_path = PathBuf::from(&existing_state.projects[1].path);

        let relocated = store.relocate_project(&stale_path, &existing_path)?;

        assert_eq!(relocated.projects.len(), 1);
        assert_eq!(relocated.projects[0].path, existing_path.to_string_lossy());
        assert_eq!(
            relocated.last_selected_project,
            Some(relocated.projects[0].path.clone())
        );
        Ok(())
    }

    #[test]
    fn failed_relocate_should_not_change_desktop_state() -> TestResult {
        let data = TempDir::new()?;
        let project = TempDir::new()?;
        let invalid_replacement = TempDir::new()?;
        let mut store = AppStateStore::load(data.path())?;
        let original = store.add_project(project.path())?;
        let path = PathBuf::from(&original.projects[0].path);

        assert!(
            store
                .relocate_project(&path, invalid_replacement.path())
                .is_err()
        );
        assert_eq!(store.snapshot().projects, original.projects);
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
