use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sidequest_core::{
    Error as CoreError, Quest, QuestCollection, QuestFileIssue, QuestId, Workspace, WorkspaceAccess,
};

use crate::error::DesktopError;
use crate::locale::{EffectiveLocale, LanguagePreference};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStateDto {
    pub(crate) projects: Vec<ProjectDto>,
    pub(crate) last_selected_project: Option<String>,
    pub(crate) panel_preferences: PanelPreferencesDto,
    pub(crate) quick_capture: QuickCapturePreferencesDto,
    pub(crate) onboarding_step: OnboardingStepDto,
    pub(crate) recovery_warning: Option<RecoveryWarningDto>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum OnboardingStepDto {
    AddProject,
    QuickCapture,
    CodingAgents,
    Complete,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutSpecDto {
    pub(crate) modifiers: Vec<ShortcutModifierDto>,
    pub(crate) key: String,
    pub(crate) display: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ShortcutModifierDto {
    Command,
    Control,
    Option,
    Shift,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ShortcutRegistrationDto {
    Active,
    Conflict,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SettingsDto {
    pub(crate) shortcut: ShortcutSpecDto,
    pub(crate) shortcut_registration: ShortcutRegistrationDto,
    pub(crate) launch_at_login: bool,
    pub(crate) launch_at_login_available: bool,
    pub(crate) debug_profile: bool,
    pub(crate) app_version: String,
    pub(crate) license_text: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiagnosticReportDto {
    pub(crate) generated_at: String,
    pub(crate) report: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum LanguagePreferenceDto {
    System,
    En,
    #[serde(rename = "zh-CN")]
    ZhCn,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EffectiveLocaleDto {
    En,
    #[serde(rename = "zh-CN")]
    ZhCn,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocaleSettingsDto {
    pub(crate) preference: LanguagePreferenceDto,
    pub(crate) effective_locale: EffectiveLocaleDto,
}

impl From<LanguagePreferenceDto> for LanguagePreference {
    fn from(preference: LanguagePreferenceDto) -> Self {
        match preference {
            LanguagePreferenceDto::System => Self::System,
            LanguagePreferenceDto::En => Self::English,
            LanguagePreferenceDto::ZhCn => Self::SimplifiedChinese,
        }
    }
}

impl From<LanguagePreference> for LanguagePreferenceDto {
    fn from(preference: LanguagePreference) -> Self {
        match preference {
            LanguagePreference::System => Self::System,
            LanguagePreference::English => Self::En,
            LanguagePreference::SimplifiedChinese => Self::ZhCn,
        }
    }
}

impl From<EffectiveLocale> for EffectiveLocaleDto {
    fn from(locale: EffectiveLocale) -> Self {
        match locale {
            EffectiveLocale::English => Self::En,
            EffectiveLocale::SimplifiedChinese => Self::ZhCn,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum IntegrationIdDto {
    Cli,
    Codex,
    Claude,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum IntegrationStateDto {
    Installed,
    NotInstalled,
    UpdateAvailable,
    RepairRequired,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IntegrationItemDto {
    pub(crate) id: IntegrationIdDto,
    pub(crate) state: IntegrationStateDto,
    pub(crate) path: String,
    pub(crate) installed_version: Option<String>,
    pub(crate) bundled_version: String,
    pub(crate) message: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickCapturePreferencesDto {
    pub(crate) last_project_path: Option<String>,
    pub(crate) position: Option<QuickCapturePositionDto>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickCapturePositionDto {
    pub(crate) x: i32,
    pub(crate) y: i32,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PanelPreferencesDto {
    pub(crate) sidebar_width: u16,
    pub(crate) sidebar_collapsed: bool,
    pub(crate) drawer_width: u16,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectDto {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) state: ProjectStateDto,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProjectStateDto {
    Writable,
    ReadOnly,
    Unavailable,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecoveryWarningDto {
    pub(crate) message: String,
    pub(crate) path: String,
    pub(crate) backup_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSnapshotDto {
    pub(crate) project_path: String,
    pub(crate) access: WorkspaceAccessDto,
    pub(crate) quests: Vec<QuestDto>,
    pub(crate) issues: Vec<QuestFileIssueDto>,
}

impl WorkspaceSnapshotDto {
    pub(crate) fn from_collection(
        workspace: &Workspace,
        collection: &QuestCollection,
        access: WorkspaceAccess,
    ) -> Self {
        Self {
            project_path: display_path(workspace.root().as_path()),
            access: access.into(),
            quests: collection.quests.iter().map(QuestDto::from).collect(),
            issues: collection
                .issues
                .iter()
                .map(QuestFileIssueDto::from)
                .collect(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum WorkspaceAccessDto {
    Writable,
    ReadOnly,
}

impl From<WorkspaceAccess> for WorkspaceAccessDto {
    fn from(access: WorkspaceAccess) -> Self {
        match access {
            WorkspaceAccess::Writable => Self::Writable,
            WorkspaceAccess::ReadOnly => Self::ReadOnly,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuestDto {
    pub(crate) id: String,
    pub(crate) created_at: String,
    pub(crate) content: String,
    pub(crate) status: String,
}

impl From<&Quest> for QuestDto {
    fn from(quest: &Quest) -> Self {
        Self {
            id: quest.id.to_string(),
            created_at: quest.created_at.to_rfc3339(),
            content: quest.content.clone(),
            status: quest.status.to_string(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuestFileIssueDto {
    pub(crate) path: String,
    pub(crate) message: String,
}

impl From<&QuestFileIssue> for QuestFileIssueDto {
    fn from(issue: &QuestFileIssue) -> Self {
        Self {
            path: display_path(&issue.path),
            message: issue.message.clone(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeletedQuestDto {
    pub(crate) id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickCaptureResultDto {
    pub(crate) quest: QuestDto,
    pub(crate) preference_warning: Option<CommandErrorDto>,
}

impl From<QuestId> for DeletedQuestDto {
    fn from(id: QuestId) -> Self {
        Self { id: id.to_string() }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceInvalidatedDto {
    pub(crate) project_path: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandErrorDto {
    pub(crate) code: &'static str,
    pub(crate) message: String,
    pub(crate) path: Option<String>,
}

impl From<DesktopError> for CommandErrorDto {
    fn from(error: DesktopError) -> Self {
        let message = error.to_string();
        match error {
            DesktopError::ProjectNotFound { path } => {
                Self::new("project_not_found", message, Some(path))
            }
            DesktopError::InvalidAppState { path, .. } => {
                Self::new("io_error", message, Some(path))
            }
            DesktopError::Io { path, source, .. }
                if matches!(
                    source.kind(),
                    io::ErrorKind::PermissionDenied | io::ErrorKind::ReadOnlyFilesystem
                ) =>
            {
                Self::new("workspace_read_only", message, Some(path))
            }
            DesktopError::Io { path, .. } => Self::new("io_error", message, Some(path)),
            DesktopError::Watcher { path, .. } => Self::new("io_error", message, Some(path)),
            DesktopError::Window { .. } => Self::new("internal_error", message, None),
            DesktopError::InvalidShortcut { .. } => Self::new("invalid_shortcut", message, None),
            DesktopError::ShortcutConflict { .. } => Self::new("shortcut_conflict", message, None),
            DesktopError::IntegrationConflict { path, .. } => {
                Self::new("integration_conflict", message, Some(path))
            }
            DesktopError::IntegrationUnavailable { path, .. } => {
                Self::new("integration_unavailable", message, Some(path))
            }
            DesktopError::StateLock => Self::new("internal_error", message, None),
            DesktopError::Core(core) => from_core_error(core, message),
        }
    }
}

impl CommandErrorDto {
    fn new(code: &'static str, message: String, path: Option<PathBuf>) -> Self {
        Self {
            code,
            message,
            path: path.as_deref().map(display_path),
        }
    }
}

fn from_core_error(error: CoreError, message: String) -> CommandErrorDto {
    match error {
        CoreError::InvalidProjectRoot { path }
        | CoreError::WorkspaceNotFound { path }
        | CoreError::InvalidWorkspaceLayout { path, .. } => {
            CommandErrorDto::new("workspace_unavailable", message, Some(path))
        }
        CoreError::InvalidQuestId { .. }
        | CoreError::InvalidQuestStatus { .. }
        | CoreError::InvalidContent => CommandErrorDto::new("invalid_arguments", message, None),
        CoreError::QuestNotFound { .. } => CommandErrorDto::new("quest_not_found", message, None),
        CoreError::InvalidQuestFile { path, .. } => {
            CommandErrorDto::new("quest_file_invalid", message, Some(path))
        }
        CoreError::Io { path, source, .. }
            if matches!(
                source.kind(),
                io::ErrorKind::PermissionDenied | io::ErrorKind::ReadOnlyFilesystem
            ) =>
        {
            CommandErrorDto::new("workspace_read_only", message, Some(path))
        }
        CoreError::Io { path, .. } => CommandErrorDto::new("io_error", message, Some(path)),
        CoreError::UnsafeDeleteTarget { path } => {
            CommandErrorDto::new("internal_error", message, Some(path))
        }
        _ => CommandErrorDto::new("internal_error", message, None),
    }
}

pub(crate) fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::io;
    use std::path::PathBuf;

    use super::{
        CommandErrorDto, EffectiveLocaleDto, LanguagePreferenceDto, LocaleSettingsDto, ProjectDto,
        ProjectStateDto,
    };
    use crate::error::DesktopError;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn dto_serialization_should_use_camel_case_values() -> TestResult {
        let project = ProjectDto {
            path: "/project".to_owned(),
            name: "project".to_owned(),
            state: ProjectStateDto::ReadOnly,
        };

        let value = serde_json::to_value(project)?;

        assert_eq!(value["state"], "readOnly");
        Ok(())
    }

    #[test]
    fn permission_errors_should_map_to_workspace_read_only() {
        let error = DesktopError::io(
            "write",
            PathBuf::from("/project/.sidequest"),
            io::Error::from(io::ErrorKind::PermissionDenied),
        );

        let dto = CommandErrorDto::from(error);

        assert_eq!(dto.code, "workspace_read_only");
        assert_eq!(dto.path.as_deref(), Some("/project/.sidequest"));
    }

    #[test]
    fn locale_settings_should_serialize_stable_locale_values() -> TestResult {
        let value = serde_json::to_value(LocaleSettingsDto {
            preference: LanguagePreferenceDto::ZhCn,
            effective_locale: EffectiveLocaleDto::ZhCn,
        })?;

        assert_eq!(value["preference"], "zh-CN");
        assert_eq!(value["effectiveLocale"], "zh-CN");
        Ok(())
    }
}
