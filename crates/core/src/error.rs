use std::io;
use std::path::PathBuf;

use thiserror::Error as ThisError;

use crate::QuestId;

/// An error returned by the Sidequest domain and filesystem operations.
#[derive(Debug, ThisError)]
#[non_exhaustive]
pub enum Error {
    /// The supplied project root does not exist or is not a directory.
    #[error("invalid project root: {path}")]
    InvalidProjectRoot {
        /// The rejected project path.
        path: PathBuf,
    },

    /// No `.sidequest/` directory exists at the requested location.
    #[error("workspace not found at: {path}")]
    WorkspaceNotFound {
        /// The project path that was checked.
        path: PathBuf,
    },

    /// A Workspace path exists but does not have a safe, usable layout.
    #[error("invalid workspace layout at {path}: {message}")]
    InvalidWorkspaceLayout {
        /// The invalid path.
        path: PathBuf,
        /// A human-readable explanation of the invalid layout.
        message: String,
    },

    /// A Quest identifier is not `sq_` followed by a valid ULID.
    #[error("invalid quest id: {value}")]
    InvalidQuestId {
        /// The rejected identifier.
        value: String,
    },

    /// Quest content contains only whitespace.
    #[error("quest content must not be blank")]
    InvalidContent,

    /// A status string is not one of the three supported values.
    #[error("invalid quest status: {value}")]
    InvalidQuestStatus {
        /// The rejected status value.
        value: String,
    },

    /// No Quest file exists for the supplied identifier.
    #[error("quest not found: {id}")]
    QuestNotFound {
        /// The identifier that was not found.
        id: QuestId,
    },

    /// A candidate Quest file cannot be parsed safely.
    #[error("invalid quest file at {path}: {message}")]
    InvalidQuestFile {
        /// The path of the damaged file.
        path: PathBuf,
        /// A human-readable parsing or validation error.
        message: String,
    },

    /// A request to remove Sidequest data failed its safety checks.
    #[error("refused unsafe Sidequest data deletion at: {path}")]
    UnsafeDeleteTarget {
        /// The path that was refused.
        path: PathBuf,
    },

    /// An operating-system filesystem operation failed.
    #[error("{operation} failed for {path}: {source}")]
    Io {
        /// The operation being attempted.
        operation: &'static str,
        /// The path involved in the operation.
        path: PathBuf,
        /// The underlying operating-system error.
        #[source]
        source: io::Error,
    },
}

/// A result returned by Sidequest Core.
pub type Result<T> = std::result::Result<T, Error>;

pub(crate) fn io_error(
    operation: &'static str,
    path: impl Into<PathBuf>,
    source: io::Error,
) -> Error {
    Error::Io {
        operation,
        path: path.into(),
        source,
    }
}
