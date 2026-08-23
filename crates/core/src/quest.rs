use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;

use chrono::{DateTime, FixedOffset};
use ulid::Ulid;

use crate::{Error, Result};

const QUEST_ID_PREFIX: &str = "sq_";

/// A validated Quest identifier backed by a ULID.
///
/// # Examples
///
/// ```
/// use std::str::FromStr;
///
/// use sidequest_core::QuestId;
///
/// let id = QuestId::from_str("sq_01ARZ3NDEKTSV4RRFFQ69G5FAV")?;
/// assert_eq!(id.to_string(), "sq_01ARZ3NDEKTSV4RRFFQ69G5FAV");
/// # Ok::<(), sidequest_core::Error>(())
/// ```
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct QuestId(Ulid);

impl QuestId {
    pub(crate) fn new() -> Self {
        Self(Ulid::new())
    }

    /// Returns the canonical Markdown filename for this identifier.
    #[must_use]
    pub fn filename(self) -> String {
        format!("{self}.md")
    }

    /// Returns the underlying ULID value.
    #[must_use]
    pub const fn as_ulid(self) -> Ulid {
        self.0
    }
}

impl fmt::Display for QuestId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{QUEST_ID_PREFIX}{}", self.0)
    }
}

impl FromStr for QuestId {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self> {
        let Some(encoded) = value.strip_prefix(QUEST_ID_PREFIX) else {
            return Err(Error::InvalidQuestId {
                value: value.to_owned(),
            });
        };

        if encoded.len() != 26 {
            return Err(Error::InvalidQuestId {
                value: value.to_owned(),
            });
        }

        Ulid::from_string(encoded)
            .map(Self)
            .map_err(|_| Error::InvalidQuestId {
                value: value.to_owned(),
            })
    }
}

/// The lifecycle state of a Quest.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum QuestStatus {
    /// Newly captured work that has not been prepared.
    Inbox,
    /// Work that is ready to be acted on.
    Ready,
    /// Completed work.
    Done,
}

impl fmt::Display for QuestStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Inbox => "inbox",
            Self::Ready => "ready",
            Self::Done => "done",
        })
    }
}

impl FromStr for QuestStatus {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self> {
        match value {
            "inbox" => Ok(Self::Inbox),
            "ready" => Ok(Self::Ready),
            "done" => Ok(Self::Done),
            _ => Err(Error::InvalidQuestStatus {
                value: value.to_owned(),
            }),
        }
    }
}

/// A Quest loaded from the canonical project storage.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Quest {
    /// The identifier derived from the Quest filename.
    pub id: QuestId,
    /// The timestamp recorded when the Quest was created.
    pub created_at: DateTime<FixedOffset>,
    /// The complete Markdown body entered by the user.
    pub content: String,
    /// The current Quest lifecycle status.
    pub status: QuestStatus,
}

/// User-controlled input for creating a Quest.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateQuest {
    /// The complete Markdown content for the new Quest.
    pub content: String,
}

/// A successfully loaded set of Quests plus isolated file issues.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct QuestCollection {
    /// Valid Quests in deterministic contract order.
    pub quests: Vec<Quest>,
    /// Candidate files that could not be loaded.
    pub issues: Vec<QuestFileIssue>,
}

/// A non-fatal problem found while loading one candidate Quest file.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QuestFileIssue {
    /// The path to the damaged candidate file.
    pub path: PathBuf,
    /// A human-readable explanation of the issue.
    pub message: String,
}

pub(crate) fn validate_content(content: &str) -> Result<()> {
    if content.trim().is_empty() {
        return Err(Error::InvalidContent);
    }

    Ok(())
}
