use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use crate::error::io_error;
use crate::quest::validate_content;
use crate::storage;
use crate::{CreateQuest, Error, Quest, QuestCollection, QuestId, QuestStatus, Result};

const SIDEQUEST_DIRECTORY: &str = ".sidequest";
const QUESTS_DIRECTORY: &str = "quests";

/// The effective write capability of an opened Workspace.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WorkspaceAccess {
    /// Quest files can be created, updated, and deleted.
    Writable,
    /// Quest files can be read but the Quest directory cannot be written.
    ReadOnly,
}

/// The canonical project directory that owns a Sidequest Workspace.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkspaceRoot(PathBuf);

impl WorkspaceRoot {
    /// Returns the canonical project directory as a path.
    #[must_use]
    pub fn as_path(&self) -> &Path {
        &self.0
    }
}

impl fmt::Display for WorkspaceRoot {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.display().fmt(formatter)
    }
}

/// An opened Sidequest Workspace rooted at a canonical project directory.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Workspace {
    root: WorkspaceRoot,
}

impl Workspace {
    /// Returns the canonical root of this Workspace.
    #[must_use]
    pub const fn root(&self) -> &WorkspaceRoot {
        &self.root
    }

    /// Probes whether the Quest directory can currently be written.
    ///
    /// The probe uses a uniquely named ignored temporary file and removes it before returning.
    ///
    /// # Errors
    ///
    /// Returns an error when the Workspace layout is invalid or an I/O failure other than a
    /// read-only filesystem prevents the probe from completing safely.
    pub fn access(&self) -> Result<WorkspaceAccess> {
        storage::probe_workspace_access(&self.quests_directory()?)
    }

    /// Creates an Inbox Quest using the supplied content.
    ///
    /// # Errors
    ///
    /// Returns an error when content is blank, the Workspace layout is invalid, or the Quest
    /// cannot be written atomically.
    pub fn create_quest(&self, input: CreateQuest) -> Result<Quest> {
        validate_content(&input.content)?;
        let quests_directory = self.quests_directory()?;
        let id = QuestId::new();
        let quest = Quest {
            id,
            created_at: Local::now().fixed_offset(),
            content: input.content,
            status: QuestStatus::Inbox,
        };

        storage::write_quest(&quests_directory.join(id.filename()), &quest)?;
        Ok(quest)
    }

    /// Loads one Quest by identifier.
    ///
    /// # Errors
    ///
    /// Returns an error when the Workspace layout is invalid, the Quest does not exist, or its
    /// file is damaged.
    pub fn get_quest(&self, id: &QuestId) -> Result<Quest> {
        let path = self.quests_directory()?.join(id.filename());
        storage::read_quest(&path, Some(*id))
    }

    /// Loads all valid Quests and isolates damaged candidate files as issues.
    ///
    /// # Errors
    ///
    /// Returns an error only when the Quest directory itself cannot be accessed safely.
    pub fn list_quests(&self) -> Result<QuestCollection> {
        storage::list_quests(&self.quests_directory()?)
    }

    /// Replaces a Quest's Markdown content without changing its identity or creation time.
    ///
    /// # Errors
    ///
    /// Returns an error when content is blank, the Quest is unavailable or damaged, or the updated
    /// file cannot be written atomically.
    pub fn update_quest_content(&self, id: &QuestId, content: String) -> Result<Quest> {
        validate_content(&content)?;
        let path = self.quests_directory()?.join(id.filename());
        let mut quest = storage::read_quest(&path, Some(*id))?;
        quest.content = content;
        storage::write_quest(&path, &quest)?;
        Ok(quest)
    }

    /// Sets a Quest's lifecycle status without moving or renaming its file.
    ///
    /// # Errors
    ///
    /// Returns an error when the Quest is unavailable or damaged, or the updated file cannot be
    /// written atomically.
    pub fn set_quest_status(&self, id: &QuestId, status: QuestStatus) -> Result<Quest> {
        let path = self.quests_directory()?.join(id.filename());
        let mut quest = storage::read_quest(&path, Some(*id))?;
        quest.status = status;
        storage::write_quest(&path, &quest)?;
        Ok(quest)
    }

    /// Deletes exactly one Quest file.
    ///
    /// # Errors
    ///
    /// Returns an error when the Quest does not exist, is not a regular file, or cannot be deleted.
    pub fn delete_quest(&self, id: &QuestId) -> Result<()> {
        let path = self.quests_directory()?.join(id.filename());
        storage::delete_quest(&path, *id)
    }

    /// Searches current Workspace content with a case-insensitive substring match.
    ///
    /// An empty query returns the same valid Quest set as [`Self::list_quests`].
    ///
    /// # Errors
    ///
    /// Returns an error only when the Quest directory itself cannot be accessed safely.
    pub fn search_quests(&self, query: &str) -> Result<QuestCollection> {
        let mut collection = self.list_quests()?;
        if query.is_empty() {
            return Ok(collection);
        }

        let normalized_query = query.to_lowercase();
        collection
            .quests
            .retain(|quest| quest.content.to_lowercase().contains(&normalized_query));
        Ok(collection)
    }

    /// Deletes only this Workspace's canonical `.sidequest/` directory.
    ///
    /// The Workspace is consumed so it cannot be reused after its backing data is removed.
    ///
    /// # Errors
    ///
    /// Returns an error when the target is missing, is a symlink, resolves outside the canonical
    /// project root, or cannot be deleted.
    pub fn delete_sidequest_data(self) -> Result<()> {
        let sidequest_directory = self.sidequest_directory();
        let metadata = fs::symlink_metadata(&sidequest_directory).map_err(|source| {
            if source.kind() == std::io::ErrorKind::NotFound {
                Error::WorkspaceNotFound {
                    path: self.root.0.clone(),
                }
            } else {
                io_error("inspect Workspace data", &sidequest_directory, source)
            }
        })?;

        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(Error::UnsafeDeleteTarget {
                path: sidequest_directory,
            });
        }

        let canonical_target = fs::canonicalize(&sidequest_directory).map_err(|source| {
            io_error("canonicalize Workspace data", &sidequest_directory, source)
        })?;
        if canonical_target != sidequest_directory
            || sidequest_directory.parent() != Some(self.root.as_path())
        {
            return Err(Error::UnsafeDeleteTarget {
                path: sidequest_directory,
            });
        }

        fs::remove_dir_all(&sidequest_directory)
            .map_err(|source| io_error("delete Workspace data", &sidequest_directory, source))?;
        storage::sync_directory(self.root.as_path())
    }

    fn sidequest_directory(&self) -> PathBuf {
        self.root.0.join(SIDEQUEST_DIRECTORY)
    }

    fn quests_directory(&self) -> Result<PathBuf> {
        let path = self.sidequest_directory().join(QUESTS_DIRECTORY);
        require_regular_directory(
            &path,
            "Quest directory is missing or is not a regular directory",
        )?;
        Ok(path)
    }
}

/// Initializes a Workspace in exactly the supplied existing project directory.
///
/// Repeated initialization is idempotent and repairs a missing `quests/` directory under an
/// existing regular `.sidequest/` directory.
///
/// # Errors
///
/// Returns an error when the project root is invalid, storage paths are symlinks or non-directories,
/// or the directories cannot be created.
pub fn init_workspace(project_root: &Path) -> Result<Workspace> {
    let root = canonical_project_root(project_root)?;
    let sidequest_directory = root.join(SIDEQUEST_DIRECTORY);
    create_regular_directory(
        &sidequest_directory,
        "Workspace data path is not a regular directory",
    )?;
    create_regular_directory(
        &sidequest_directory.join(QUESTS_DIRECTORY),
        "Quest path is not a regular directory",
    )?;
    Ok(Workspace {
        root: WorkspaceRoot(root),
    })
}

/// Opens a Workspace in exactly the supplied project directory without searching parents.
///
/// # Errors
///
/// Returns an error when the project root is invalid or does not contain a regular `.sidequest/`
/// directory.
pub fn open_workspace(project_root: &Path) -> Result<Workspace> {
    let root = canonical_project_root(project_root)?;
    let sidequest_directory = root.join(SIDEQUEST_DIRECTORY);
    match fs::symlink_metadata(&sidequest_directory) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => Ok(Workspace {
            root: WorkspaceRoot(root),
        }),
        Ok(_) => Err(Error::InvalidWorkspaceLayout {
            path: sidequest_directory,
            message: "Workspace data path is not a regular directory".to_owned(),
        }),
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
            Err(Error::WorkspaceNotFound { path: root })
        }
        Err(source) => Err(io_error(
            "inspect Workspace data",
            sidequest_directory,
            source,
        )),
    }
}

/// Resolves the nearest Workspace by searching the supplied directory and each parent.
///
/// # Errors
///
/// Returns an error when the starting directory is invalid, a candidate `.sidequest/` path is
/// unsafe, or no Workspace exists in the ancestor chain.
pub fn resolve_workspace(start_path: &Path) -> Result<Workspace> {
    let start = canonical_project_root(start_path)?;
    for candidate in start.ancestors() {
        let sidequest_directory = candidate.join(SIDEQUEST_DIRECTORY);
        match fs::symlink_metadata(&sidequest_directory) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
                return Ok(Workspace {
                    root: WorkspaceRoot(candidate.to_path_buf()),
                });
            }
            Ok(_) => {
                return Err(Error::InvalidWorkspaceLayout {
                    path: sidequest_directory,
                    message: "Workspace data path is not a regular directory".to_owned(),
                });
            }
            Err(source) if source.kind() == std::io::ErrorKind::NotFound => {}
            Err(source) => {
                return Err(io_error(
                    "inspect Workspace data",
                    sidequest_directory,
                    source,
                ));
            }
        }
    }

    Err(Error::WorkspaceNotFound { path: start })
}

fn canonical_project_root(path: &Path) -> Result<PathBuf> {
    let canonical = fs::canonicalize(path).map_err(|source| {
        if source.kind() == std::io::ErrorKind::NotFound {
            Error::InvalidProjectRoot {
                path: path.to_path_buf(),
            }
        } else {
            io_error("canonicalize project root", path, source)
        }
    })?;
    let metadata = fs::metadata(&canonical)
        .map_err(|source| io_error("inspect project root", &canonical, source))?;
    if !metadata.is_dir() {
        return Err(Error::InvalidProjectRoot { path: canonical });
    }

    Ok(canonical)
}

fn create_regular_directory(path: &Path, invalid_message: &str) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => Ok(()),
        Ok(_) => Err(Error::InvalidWorkspaceLayout {
            path: path.to_path_buf(),
            message: invalid_message.to_owned(),
        }),
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => fs::create_dir(path)
            .map_err(|source| io_error("create Workspace directory", path, source)),
        Err(source) => Err(io_error("inspect Workspace directory", path, source)),
    }
}

fn require_regular_directory(path: &Path, invalid_message: &str) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => Ok(()),
        Ok(_) => Err(Error::InvalidWorkspaceLayout {
            path: path.to_path_buf(),
            message: invalid_message.to_owned(),
        }),
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
            Err(Error::InvalidWorkspaceLayout {
                path: path.to_path_buf(),
                message: invalid_message.to_owned(),
            })
        }
        Err(source) => Err(io_error("inspect Workspace directory", path, source)),
    }
}
