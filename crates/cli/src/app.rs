use std::env;
use std::ffi::{OsStr, OsString};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::error::ErrorKind;
use clap::{Parser, Subcommand};
use sidequest_core::{
    CreateQuest, Error as CoreError, Quest, QuestCollection, QuestId, QuestStatus, Workspace,
    init_workspace, open_workspace, resolve_workspace,
};

use crate::output;

#[derive(Debug, Parser)]
#[command(name = "sq", version, about = "Project-local memory for software work")]
struct Cli {
    #[arg(long, global = true, value_name = "PATH")]
    workspace: Option<PathBuf>,

    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Initialize Sidequest in an exact project directory.
    Init {
        #[arg(value_name = "PATH")]
        path: Option<PathBuf>,
    },
    /// Create an Inbox Quest.
    Add {
        #[arg(
            value_name = "CONTENT",
            required_unless_present = "stdin",
            conflicts_with = "stdin"
        )]
        content: Option<String>,
        #[arg(long)]
        stdin: bool,
    },
    /// List Quests in deterministic order.
    List {
        #[arg(long = "status", value_name = "STATUS", conflicts_with = "all")]
        statuses: Vec<QuestStatus>,
        #[arg(long)]
        all: bool,
    },
    /// Show one complete Quest.
    Show {
        #[arg(value_name = "ID")]
        id: QuestId,
    },
    /// Search Quest content in the current Workspace.
    Search {
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long = "status", value_name = "STATUS")]
        statuses: Vec<QuestStatus>,
    },
    /// Replace one Quest's content.
    Update {
        #[arg(value_name = "ID")]
        id: QuestId,
        #[arg(
            value_name = "CONTENT",
            required_unless_present = "stdin",
            conflicts_with = "stdin"
        )]
        content: Option<String>,
        #[arg(long)]
        stdin: bool,
    },
    /// Set one Quest's status.
    Status {
        #[arg(value_name = "ID")]
        id: QuestId,
        #[arg(value_name = "STATUS")]
        status: QuestStatus,
    },
    /// Delete one Quest.
    Delete {
        #[arg(value_name = "ID")]
        id: QuestId,
        #[arg(long)]
        yes: bool,
    },
}

pub(crate) enum Success {
    Init {
        workspace: PathBuf,
    },
    Quest {
        workspace: PathBuf,
        quest: Quest,
        action: &'static str,
    },
    Collection {
        workspace: PathBuf,
        collection: QuestCollection,
    },
    Deleted {
        workspace: PathBuf,
        id: QuestId,
    },
    Cancelled,
}

pub(crate) struct Failure {
    pub(crate) code: &'static str,
    pub(crate) message: String,
    pub(crate) path: Option<PathBuf>,
    pub(crate) exit_code: u8,
}

impl Failure {
    fn invalid_arguments(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_arguments",
            message: message.into(),
            path: None,
            exit_code: 2,
        }
    }

    fn confirmation_required() -> Self {
        Self {
            code: "confirmation_required",
            message: "Delete requires --yes in JSON mode".to_owned(),
            path: None,
            exit_code: 2,
        }
    }

    fn io(message: impl Into<String>, path: Option<PathBuf>) -> Self {
        Self {
            code: "io_error",
            message: message.into(),
            path,
            exit_code: 5,
        }
    }
}

impl From<CoreError> for Failure {
    fn from(error: CoreError) -> Self {
        let message = error.to_string();
        match error {
            CoreError::InvalidProjectRoot { path } => Self {
                code: "workspace_unavailable",
                message,
                path: Some(path),
                exit_code: 3,
            },
            CoreError::WorkspaceNotFound { path } => Self {
                code: "workspace_not_found",
                message,
                path: Some(path),
                exit_code: 3,
            },
            CoreError::InvalidWorkspaceLayout { path, .. } => Self {
                code: "workspace_unavailable",
                message,
                path: Some(path),
                exit_code: 3,
            },
            CoreError::InvalidQuestId { .. } | CoreError::InvalidQuestStatus { .. } => Self {
                code: "invalid_arguments",
                message,
                path: None,
                exit_code: 2,
            },
            CoreError::InvalidContent => Self {
                code: "invalid_content",
                message,
                path: None,
                exit_code: 2,
            },
            CoreError::QuestNotFound { .. } => Self {
                code: "quest_not_found",
                message,
                path: None,
                exit_code: 4,
            },
            CoreError::InvalidQuestFile { path, .. } => Self {
                code: "quest_file_invalid",
                message,
                path: Some(path),
                exit_code: 6,
            },
            CoreError::Io { path, source, .. }
                if source.kind() == io::ErrorKind::PermissionDenied =>
            {
                Self {
                    code: "workspace_read_only",
                    message,
                    path: Some(path),
                    exit_code: 5,
                }
            }
            CoreError::Io { path, .. } => Self {
                code: "io_error",
                message,
                path: Some(path),
                exit_code: 5,
            },
            CoreError::UnsafeDeleteTarget { path } => Self {
                code: "internal_error",
                message,
                path: Some(path),
                exit_code: 1,
            },
            _ => Self {
                code: "internal_error",
                message,
                path: None,
                exit_code: 1,
            },
        }
    }
}

pub(crate) fn run() -> ExitCode {
    let arguments: Vec<OsString> = env::args_os().collect();
    let json_requested = arguments
        .iter()
        .any(|argument| argument == OsStr::new("--json"));
    let cli = match Cli::try_parse_from(arguments) {
        Ok(cli) => cli,
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::DisplayHelp | ErrorKind::DisplayVersion
            ) =>
        {
            let exit_code = error.exit_code();
            let _print_result = error.print();
            return ExitCode::from(u8::try_from(exit_code).unwrap_or(1));
        }
        Err(error) => {
            if json_requested {
                let failure = Failure::invalid_arguments(error.to_string());
                let _write_result = output::write_failure(&failure, true);
            } else {
                let _print_result = error.print();
            }
            return ExitCode::from(2);
        }
    };

    let json = cli.json;
    match execute(cli) {
        Ok(success) => match output::write_success(&success, json) {
            Ok(()) => ExitCode::SUCCESS,
            Err(source) => {
                let failure = Failure::io(format!("write output: {source}"), None);
                let _write_result = output::write_failure(&failure, json);
                ExitCode::from(failure.exit_code)
            }
        },
        Err(failure) => {
            let exit_code = failure.exit_code;
            let _write_result = output::write_failure(&failure, json);
            ExitCode::from(exit_code)
        }
    }
}

fn execute(cli: Cli) -> Result<Success, Failure> {
    let Cli {
        workspace,
        json,
        command,
    } = cli;
    if let Command::Init { path } = command {
        if workspace.is_some() {
            return Err(Failure::invalid_arguments(
                "--workspace cannot be combined with init",
            ));
        }
        let root = path.map_or_else(current_directory, Ok)?;
        let workspace = init_workspace(&root).map_err(Failure::from)?;
        return Ok(Success::Init {
            workspace: workspace.root().as_path().to_path_buf(),
        });
    }

    let workspace = load_workspace(workspace.as_deref())?;
    let root = workspace.root().as_path().to_path_buf();
    match command {
        Command::Add { content, stdin } => {
            let content = command_content(content, stdin)?;
            let quest = workspace
                .create_quest(CreateQuest { content })
                .map_err(Failure::from)?;
            Ok(Success::Quest {
                workspace: root,
                quest,
                action: "Created",
            })
        }
        Command::List { statuses, all } => {
            let mut collection = workspace.list_quests().map_err(Failure::from)?;
            if !all {
                let statuses = if statuses.is_empty() {
                    vec![QuestStatus::Inbox, QuestStatus::Ready]
                } else {
                    statuses
                };
                retain_statuses(&mut collection, &statuses);
            }
            Ok(Success::Collection {
                workspace: root,
                collection,
            })
        }
        Command::Show { id } => {
            let quest = workspace.get_quest(&id).map_err(Failure::from)?;
            Ok(Success::Quest {
                workspace: root,
                quest,
                action: "Quest",
            })
        }
        Command::Search { query, statuses } => {
            if query.trim().is_empty() {
                return Err(Failure::invalid_arguments("search query must not be blank"));
            }
            let mut collection = workspace.search_quests(&query).map_err(Failure::from)?;
            if !statuses.is_empty() {
                retain_statuses(&mut collection, &statuses);
            }
            Ok(Success::Collection {
                workspace: root,
                collection,
            })
        }
        Command::Update { id, content, stdin } => {
            let content = command_content(content, stdin)?;
            let quest = workspace
                .update_quest_content(&id, content)
                .map_err(Failure::from)?;
            Ok(Success::Quest {
                workspace: root,
                quest,
                action: "Updated",
            })
        }
        Command::Status { id, status } => {
            let quest = workspace
                .set_quest_status(&id, status)
                .map_err(Failure::from)?;
            Ok(Success::Quest {
                workspace: root,
                quest,
                action: "Updated",
            })
        }
        Command::Delete { id, yes } => {
            if json && !yes {
                return Err(Failure::confirmation_required());
            }
            if !yes {
                workspace.get_quest(&id).map_err(Failure::from)?;
                if !confirm_delete(&id)? {
                    return Ok(Success::Cancelled);
                }
            }
            workspace.delete_quest(&id).map_err(Failure::from)?;
            Ok(Success::Deleted {
                workspace: root,
                id,
            })
        }
        Command::Init { .. } => Err(Failure {
            code: "internal_error",
            message: "init command reached an invalid execution branch".to_owned(),
            path: None,
            exit_code: 1,
        }),
    }
}

fn load_workspace(explicit: Option<&Path>) -> Result<Workspace, Failure> {
    if let Some(path) = explicit {
        return open_workspace(path).map_err(Failure::from);
    }
    resolve_workspace(&current_directory()?).map_err(Failure::from)
}

fn current_directory() -> Result<PathBuf, Failure> {
    env::current_dir()
        .map_err(|source| Failure::io(format!("read current directory: {source}"), None))
}

fn command_content(content: Option<String>, stdin_requested: bool) -> Result<String, Failure> {
    if stdin_requested {
        let mut content = String::new();
        io::stdin()
            .read_to_string(&mut content)
            .map_err(|source| Failure::io(format!("read stdin: {source}"), None))?;
        return Ok(content);
    }

    content.ok_or_else(|| Failure::invalid_arguments("content is required"))
}

fn retain_statuses(collection: &mut QuestCollection, statuses: &[QuestStatus]) {
    collection
        .quests
        .retain(|quest| statuses.contains(&quest.status));
}

fn confirm_delete(id: &QuestId) -> Result<bool, Failure> {
    let mut stderr = io::stderr().lock();
    write!(stderr, "Delete {id}? [y/N] ")
        .and_then(|()| stderr.flush())
        .map_err(|source| Failure::io(format!("write confirmation prompt: {source}"), None))?;

    let mut answer = String::new();
    io::stdin()
        .read_line(&mut answer)
        .map_err(|source| Failure::io(format!("read confirmation: {source}"), None))?;
    Ok(matches!(
        answer.trim().to_ascii_lowercase().as_str(),
        "y" | "yes"
    ))
}
