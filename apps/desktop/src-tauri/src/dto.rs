use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sidequest_core::{
    Error as CoreError, Quest, QuestCollection, QuestFileIssue, QuestId, Workspace, WorkspaceAccess,
};

use crate::error::DesktopError;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStateDto {
    pub(crate) projects: Vec<ProjectDto>,
    pub(crate) last_selected_project: Option<String>,
    pub(crate) recovery_warning: Option<RecoveryWarningDto>,
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

    use super::{CommandErrorDto, ProjectDto, ProjectStateDto};
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
}
