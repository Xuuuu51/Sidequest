//! Filesystem-backed domain library for Sidequest.
//!
//! This crate owns Workspace discovery, Quest validation and the canonical Markdown storage
//! format. CLI and Desktop adapters call this API instead of reading `.sidequest/` directly.

#![deny(missing_docs)]

mod error;
mod quest;
mod storage;
mod workspace;

pub use error::{Error, Result};
pub use quest::{CreateQuest, Quest, QuestCollection, QuestFileIssue, QuestId, QuestStatus};
pub use workspace::{Workspace, WorkspaceRoot, init_workspace, open_workspace, resolve_workspace};
