use serde::Serialize;
use sidequest_core::{Quest, QuestCollection, QuestFileIssue, QuestId};

pub(crate) const SCHEMA_VERSION: u8 = 1;

#[derive(Serialize)]
pub(crate) struct InitResponse {
    pub(crate) schema_version: u8,
    pub(crate) workspace: String,
}

#[derive(Serialize)]
pub(crate) struct QuestResponse {
    pub(crate) schema_version: u8,
    pub(crate) workspace: String,
    pub(crate) quest: QuestDto,
}

#[derive(Serialize)]
pub(crate) struct CollectionResponse {
    pub(crate) schema_version: u8,
    pub(crate) workspace: String,
    pub(crate) quests: Vec<QuestDto>,
    pub(crate) issues: Vec<IssueDto>,
}

#[derive(Serialize)]
pub(crate) struct DeleteResponse {
    pub(crate) schema_version: u8,
    pub(crate) workspace: String,
    pub(crate) deleted: DeletedDto,
}

#[derive(Serialize)]
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

#[derive(Serialize)]
pub(crate) struct IssueDto {
    pub(crate) path: String,
    pub(crate) message: String,
}

impl From<&QuestFileIssue> for IssueDto {
    fn from(issue: &QuestFileIssue) -> Self {
        Self {
            path: issue.path.to_string_lossy().into_owned(),
            message: issue.message.clone(),
        }
    }
}

impl From<&QuestCollection> for CollectionResponseParts {
    fn from(collection: &QuestCollection) -> Self {
        Self {
            quests: collection.quests.iter().map(QuestDto::from).collect(),
            issues: collection.issues.iter().map(IssueDto::from).collect(),
        }
    }
}

pub(crate) struct CollectionResponseParts {
    pub(crate) quests: Vec<QuestDto>,
    pub(crate) issues: Vec<IssueDto>,
}

#[derive(Serialize)]
pub(crate) struct DeletedDto {
    pub(crate) id: String,
}

impl From<QuestId> for DeletedDto {
    fn from(id: QuestId) -> Self {
        Self { id: id.to_string() }
    }
}

#[derive(Serialize)]
pub(crate) struct ErrorResponse {
    pub(crate) schema_version: u8,
    pub(crate) error: ErrorDto,
}

#[derive(Serialize)]
pub(crate) struct ErrorDto {
    pub(crate) code: &'static str,
    pub(crate) message: String,
    pub(crate) path: Option<String>,
}
