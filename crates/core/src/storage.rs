use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::str::FromStr;

use chrono::DateTime;
use ulid::Ulid;

use crate::error::io_error;
use crate::quest::validate_content;
use crate::{Error, Quest, QuestCollection, QuestFileIssue, QuestId, QuestStatus, Result};

const FRONTMATTER_START_LF: &str = "---\n";
const FRONTMATTER_END_LF: &str = "\n---\n\n";
const FRONTMATTER_START_CRLF: &str = "---\r\n";
const FRONTMATTER_END_CRLF: &str = "\r\n---\r\n\r\n";

pub(crate) fn read_quest(path: &Path, expected_id: Option<QuestId>) -> Result<Quest> {
    let metadata = fs::symlink_metadata(path).map_err(|source| {
        if source.kind() == io::ErrorKind::NotFound {
            expected_id.map_or_else(
                || io_error("inspect Quest file", path, source),
                |id| Error::QuestNotFound { id },
            )
        } else {
            io_error("inspect Quest file", path, source)
        }
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid_quest_file(path, "candidate is not a regular file"));
    }

    let bytes = fs::read(path).map_err(|source| io_error("read Quest file", path, source))?;
    let text = std::str::from_utf8(&bytes)
        .map_err(|source| invalid_quest_file(path, format!("file is not UTF-8: {source}")))?;
    parse_quest(path, text, expected_id)
}

pub(crate) fn write_quest(path: &Path, quest: &Quest) -> Result<()> {
    validate_content(&quest.content)?;
    let serialized = serialize_quest(quest);
    write_atomic(path, serialized.as_bytes())
}

pub(crate) fn list_quests(directory: &Path) -> Result<QuestCollection> {
    let entries = fs::read_dir(directory)
        .map_err(|source| io_error("read Quest directory", directory, source))?;
    let mut collection = QuestCollection::default();

    for entry in entries {
        let entry =
            entry.map_err(|source| io_error("read Quest directory entry", directory, source))?;
        let path = entry.path();
        if path.extension() != Some(OsStr::new("md")) {
            continue;
        }

        match read_quest(&path, None) {
            Ok(quest) => collection.quests.push(quest),
            Err(error) => collection.issues.push(QuestFileIssue {
                path,
                message: error.to_string(),
            }),
        }
    }

    collection.quests.sort_by(|left, right| {
        right
            .created_at
            .cmp(&left.created_at)
            .then_with(|| right.id.cmp(&left.id))
    });
    collection
        .issues
        .sort_by(|left, right| left.path.cmp(&right.path));
    Ok(collection)
}

pub(crate) fn delete_quest(path: &Path, id: QuestId) -> Result<()> {
    let metadata = fs::symlink_metadata(path).map_err(|source| {
        if source.kind() == io::ErrorKind::NotFound {
            Error::QuestNotFound { id }
        } else {
            io_error("inspect Quest file", path, source)
        }
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid_quest_file(path, "candidate is not a regular file"));
    }

    fs::remove_file(path).map_err(|source| io_error("delete Quest file", path, source))?;
    let Some(parent) = path.parent() else {
        return Err(invalid_quest_file(
            path,
            "Quest file has no parent directory",
        ));
    };
    sync_directory(parent)
}

pub(crate) fn sync_directory(path: &Path) -> Result<()> {
    let directory =
        File::open(path).map_err(|source| io_error("open directory for sync", path, source))?;
    directory
        .sync_all()
        .map_err(|source| io_error("sync directory", path, source))
}

fn parse_quest(path: &Path, text: &str, expected_id: Option<QuestId>) -> Result<Quest> {
    let id = parse_quest_id(path)?;
    if expected_id.is_some_and(|expected| expected != id) {
        return Err(invalid_quest_file(
            path,
            "filename does not match the requested Quest id",
        ));
    }

    let (frontmatter, content, line_ending) = split_frontmatter(path, text)?;
    let mut created_at = None;
    let mut status = None;

    for line in frontmatter.split(line_ending) {
        let Some((raw_key, raw_value)) = line.split_once(':') else {
            return Err(invalid_quest_file(path, "frontmatter line is missing ':'"));
        };
        let key = raw_key.trim();
        let value = raw_value.trim();
        match key {
            "created_at" if created_at.is_none() => {
                created_at = Some(DateTime::parse_from_rfc3339(value).map_err(|source| {
                    invalid_quest_file(path, format!("invalid created_at: {source}"))
                })?);
            }
            "status" if status.is_none() => {
                status = Some(
                    QuestStatus::from_str(value)
                        .map_err(|error| invalid_quest_file(path, error.to_string()))?,
                );
            }
            "created_at" | "status" => {
                return Err(invalid_quest_file(
                    path,
                    format!("duplicate frontmatter field: {key}"),
                ));
            }
            _ => {
                return Err(invalid_quest_file(
                    path,
                    format!("unknown frontmatter field: {key}"),
                ));
            }
        }
    }

    let created_at = created_at
        .ok_or_else(|| invalid_quest_file(path, "missing created_at frontmatter field"))?;
    let status =
        status.ok_or_else(|| invalid_quest_file(path, "missing status frontmatter field"))?;
    validate_content(content).map_err(|error| invalid_quest_file(path, error.to_string()))?;

    Ok(Quest {
        id,
        created_at,
        content: content.to_owned(),
        status,
    })
}

fn parse_quest_id(path: &Path) -> Result<QuestId> {
    let value = path
        .file_stem()
        .and_then(OsStr::to_str)
        .ok_or_else(|| invalid_quest_file(path, "filename is not valid UTF-8"))?;
    QuestId::from_str(value).map_err(|error| invalid_quest_file(path, error.to_string()))
}

fn split_frontmatter<'a>(path: &Path, text: &'a str) -> Result<(&'a str, &'a str, &'static str)> {
    let (start, end, line_ending) = if text.starts_with(FRONTMATTER_START_LF) {
        (FRONTMATTER_START_LF, FRONTMATTER_END_LF, "\n")
    } else if text.starts_with(FRONTMATTER_START_CRLF) {
        (FRONTMATTER_START_CRLF, FRONTMATTER_END_CRLF, "\r\n")
    } else {
        return Err(invalid_quest_file(
            path,
            "missing frontmatter opening delimiter",
        ));
    };

    let remainder = &text[start.len()..];
    let Some(end_index) = remainder.find(end) else {
        return Err(invalid_quest_file(
            path,
            "missing frontmatter closing delimiter and blank line",
        ));
    };
    let content_index = end_index + end.len();
    Ok((
        &remainder[..end_index],
        &remainder[content_index..],
        line_ending,
    ))
}

fn serialize_quest(quest: &Quest) -> String {
    format!(
        "---\ncreated_at: {}\nstatus: {}\n---\n\n{}",
        quest.created_at.to_rfc3339(),
        quest.status,
        quest.content
    )
}

fn write_atomic(path: &Path, content: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| invalid_quest_file(path, "Quest file has no parent directory"))?;
    let filename = path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| invalid_quest_file(path, "Quest filename is not valid UTF-8"))?;

    for _ in 0..16 {
        let temporary_path = parent.join(format!(".{filename}.{}.tmp", Ulid::new()));
        let temporary_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary_path);
        let mut temporary_file = match temporary_file {
            Ok(file) => file,
            Err(source) if source.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(source) => {
                return Err(io_error(
                    "create temporary Quest file",
                    temporary_path,
                    source,
                ));
            }
        };

        let write_result = (|| {
            temporary_file.write_all(content).map_err(|source| {
                io_error("write temporary Quest file", &temporary_path, source)
            })?;
            temporary_file.flush().map_err(|source| {
                io_error("flush temporary Quest file", &temporary_path, source)
            })?;
            temporary_file
                .sync_all()
                .map_err(|source| io_error("sync temporary Quest file", &temporary_path, source))?;
            drop(temporary_file);
            fs::rename(&temporary_path, path)
                .map_err(|source| io_error("replace Quest file", path, source))?;
            sync_directory(parent)
        })();

        if write_result.is_err() {
            let _cleanup_result = fs::remove_file(&temporary_path);
        }
        return write_result;
    }

    Err(io_error(
        "create temporary Quest file",
        path,
        io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique temporary filename",
        ),
    ))
}

fn invalid_quest_file(path: &Path, message: impl Into<String>) -> Error {
    Error::InvalidQuestFile {
        path: PathBuf::from(path),
        message: message.into(),
    }
}
