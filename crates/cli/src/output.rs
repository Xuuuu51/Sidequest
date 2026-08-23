use std::io::{self, Write};

use crate::app::{Failure, Success};
use crate::dto::{
    CollectionResponse, CollectionResponseParts, DeleteResponse, DeletedDto, ErrorDto,
    ErrorResponse, InitResponse, QuestDto, QuestResponse, SCHEMA_VERSION,
};

pub(crate) fn write_success(success: &Success, json: bool) -> io::Result<()> {
    if json {
        write_json_success(success)
    } else {
        write_human_success(success)
    }
}

pub(crate) fn write_failure(failure: &Failure, json: bool) -> io::Result<()> {
    let mut stderr = io::stderr().lock();
    if json {
        let response = ErrorResponse {
            schema_version: SCHEMA_VERSION,
            error: ErrorDto {
                code: failure.code,
                message: failure.message.clone(),
                path: failure
                    .path
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
            },
        };
        serde_json::to_writer(&mut stderr, &response).map_err(io::Error::other)?;
        writeln!(stderr)
    } else {
        writeln!(stderr, "Error: {}", failure.message)
    }
}

fn write_json_success(success: &Success) -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    match success {
        Success::Init { workspace } => serialize_line(
            &mut stdout,
            &InitResponse {
                schema_version: SCHEMA_VERSION,
                workspace: workspace.to_string_lossy().into_owned(),
            },
        ),
        Success::Quest {
            workspace, quest, ..
        } => serialize_line(
            &mut stdout,
            &QuestResponse {
                schema_version: SCHEMA_VERSION,
                workspace: workspace.to_string_lossy().into_owned(),
                quest: QuestDto::from(quest),
            },
        ),
        Success::Collection {
            workspace,
            collection,
        } => {
            let parts = CollectionResponseParts::from(collection);
            serialize_line(
                &mut stdout,
                &CollectionResponse {
                    schema_version: SCHEMA_VERSION,
                    workspace: workspace.to_string_lossy().into_owned(),
                    quests: parts.quests,
                    issues: parts.issues,
                },
            )
        }
        Success::Deleted { workspace, id } => serialize_line(
            &mut stdout,
            &DeleteResponse {
                schema_version: SCHEMA_VERSION,
                workspace: workspace.to_string_lossy().into_owned(),
                deleted: DeletedDto::from(*id),
            },
        ),
        Success::Cancelled => Err(io::Error::other(
            "cancelled delete cannot be emitted as JSON",
        )),
    }
}

fn serialize_line(writer: &mut impl Write, value: &impl serde::Serialize) -> io::Result<()> {
    serde_json::to_writer(&mut *writer, value).map_err(io::Error::other)?;
    writeln!(writer)
}

fn write_human_success(success: &Success) -> io::Result<()> {
    match success {
        Success::Init { workspace } => {
            println!("Initialized {}", workspace.display());
        }
        Success::Quest { quest, action, .. } => {
            println!(
                "{action} {}\nStatus: {}\nCreated: {}\n\n{}",
                quest.id,
                quest.status,
                quest.created_at.to_rfc3339(),
                quest.content
            );
        }
        Success::Collection { collection, .. } => {
            if collection.quests.is_empty() {
                println!("No quests.");
            } else {
                for quest in &collection.quests {
                    let preview = quest
                        .content
                        .lines()
                        .next()
                        .unwrap_or_default()
                        .replace('\t', " ");
                    println!(
                        "{}\t{}\t{}\t{}",
                        quest.id,
                        quest.status,
                        quest.created_at.to_rfc3339(),
                        preview
                    );
                }
            }
            let mut stderr = io::stderr().lock();
            for issue in &collection.issues {
                writeln!(
                    stderr,
                    "Warning: {}: {}",
                    issue.path.display(),
                    issue.message
                )?;
            }
        }
        Success::Deleted { id, .. } => {
            println!("Deleted {id}");
        }
        Success::Cancelled => {
            eprintln!("Cancelled");
        }
    }
    Ok(())
}
