use std::io;
use std::path::PathBuf;

use sidequest_core::Error as CoreError;
use thiserror::Error as ThisError;

#[derive(Debug, ThisError)]
pub(crate) enum DesktopError {
    #[error("project is not registered: {path}")]
    ProjectNotFound { path: PathBuf },

    #[error("invalid Desktop state at {path}: {message}")]
    InvalidAppState { path: PathBuf, message: String },

    #[error("{operation} failed for {path}: {source}")]
    Io {
        operation: &'static str,
        path: PathBuf,
        #[source]
        source: io::Error,
    },

    #[error("filesystem watcher failed for {path}: {message}")]
    Watcher { path: PathBuf, message: String },

    #[error("{operation} failed: {message}")]
    Window {
        operation: &'static str,
        message: String,
    },

    #[error("Desktop state lock is unavailable")]
    StateLock,

    #[error(transparent)]
    Core(#[from] CoreError),
}

impl DesktopError {
    pub(crate) fn io(operation: &'static str, path: impl Into<PathBuf>, source: io::Error) -> Self {
        Self::Io {
            operation,
            path: path.into(),
            source,
        }
    }
}

pub(crate) type Result<T> = std::result::Result<T, DesktopError>;
