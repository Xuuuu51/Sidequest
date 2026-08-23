//! Public contract tests for Sidequest Core.

use std::error::Error as StdError;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use sidequest_core::{
    CreateQuest, Error, QuestId, QuestStatus, init_workspace, open_workspace, resolve_workspace,
};
use tempfile::TempDir;

type TestResult = std::result::Result<(), Box<dyn StdError>>;

const FIRST_ID: &str = "sq_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SECOND_ID: &str = "sq_01ARZ3NDEKTSV4RRFFQ69G5FAW";
const THIRD_ID: &str = "sq_01ARZ3NDEKTSV4RRFFQ69G5FAX";

#[test]
fn init_workspace_should_initialize_exact_project_and_be_idempotent() -> TestResult {
    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    fs::create_dir(&project)?;

    let first = init_workspace(&project)?;
    let second = init_workspace(&project)?;

    assert_eq!(first.root(), second.root());
    assert!(project.join(".sidequest/quests").is_dir());
    Ok(())
}

#[test]
fn init_workspace_should_repair_a_missing_quest_directory() -> TestResult {
    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    fs::create_dir(&project)?;
    fs::create_dir(project.join(".sidequest"))?;

    init_workspace(&project)?;

    assert!(project.join(".sidequest/quests").is_dir());
    Ok(())
}

#[test]
fn open_workspace_should_not_search_parent_but_resolve_workspace_should() -> TestResult {
    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    let nested = project.join("src/nested");
    fs::create_dir_all(&nested)?;
    let workspace = init_workspace(&project)?;

    assert!(matches!(
        open_workspace(&nested),
        Err(Error::WorkspaceNotFound { .. })
    ));
    assert_eq!(resolve_workspace(&nested)?.root(), workspace.root());
    Ok(())
}

#[test]
fn nested_directories_should_be_independent_workspaces() -> TestResult {
    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    let nested = project.join("nested");
    fs::create_dir_all(&nested)?;

    let outer = init_workspace(&project)?;
    let inner = init_workspace(&nested)?;

    assert_ne!(outer.root(), inner.root());
    assert_eq!(resolve_workspace(&nested)?.root(), inner.root());
    Ok(())
}

#[test]
fn workspace_operations_should_reject_invalid_project_roots() -> TestResult {
    let temporary = TempDir::new()?;
    let missing = temporary.path().join("missing");

    assert!(matches!(
        init_workspace(&missing),
        Err(Error::InvalidProjectRoot { .. })
    ));
    assert!(matches!(
        resolve_workspace(&missing),
        Err(Error::InvalidProjectRoot { .. })
    ));
    Ok(())
}

#[test]
fn open_workspace_should_allow_missing_quest_directory_until_quest_access() -> TestResult {
    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    fs::create_dir(&project)?;
    fs::create_dir(project.join(".sidequest"))?;

    let workspace = open_workspace(&project)?;

    assert!(matches!(
        workspace.list_quests(),
        Err(Error::InvalidWorkspaceLayout { .. })
    ));
    Ok(())
}

#[test]
fn quest_lifecycle_should_preserve_identity_creation_time_and_file_location() -> TestResult {
    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let created = workspace.create_quest(CreateQuest {
        content: "First line\nsecond line".to_owned(),
    })?;
    let path = quest_directory(temporary.path()).join(created.id.filename());

    let updated = workspace.update_quest_content(&created.id, "Changed\n".to_owned())?;
    let ready = workspace.set_quest_status(&created.id, QuestStatus::Ready)?;
    let loaded = workspace.get_quest(&created.id)?;

    assert_eq!(updated.id, created.id);
    assert_eq!(updated.created_at, created.created_at);
    assert_eq!(ready.status, QuestStatus::Ready);
    assert_eq!(loaded.content, "Changed\n");
    assert!(path.is_file());

    workspace.delete_quest(&created.id)?;
    assert!(!path.exists());
    assert!(matches!(
        workspace.get_quest(&created.id),
        Err(Error::QuestNotFound { .. })
    ));
    Ok(())
}

#[test]
fn create_should_serialize_the_canonical_file_format_without_frontmatter_id() -> TestResult {
    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let quest = workspace.create_quest(CreateQuest {
        content: "Canonical body".to_owned(),
    })?;

    let file = fs::read_to_string(quest_directory(temporary.path()).join(quest.id.filename()))?;
    let expected = format!(
        "---\ncreated_at: {}\nstatus: inbox\n---\n\nCanonical body",
        quest.created_at.to_rfc3339()
    );

    assert_eq!(file, expected);
    Ok(())
}

#[test]
fn create_and_update_should_reject_blank_content() -> TestResult {
    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let created = workspace.create_quest(CreateQuest {
        content: "valid".to_owned(),
    })?;

    assert!(matches!(
        workspace.create_quest(CreateQuest {
            content: " \n\t".to_owned(),
        }),
        Err(Error::InvalidContent)
    ));
    assert!(matches!(
        workspace.update_quest_content(&created.id, "\n".to_owned()),
        Err(Error::InvalidContent)
    ));
    Ok(())
}

#[test]
fn markdown_content_should_round_trip_without_changing_line_endings_or_trailing_newlines()
-> TestResult {
    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let content = "Heading\r\n\r\n- one\r\n- two\r\n";

    let created = workspace.create_quest(CreateQuest {
        content: content.to_owned(),
    })?;

    assert_eq!(workspace.get_quest(&created.id)?.content, content);
    Ok(())
}

#[test]
fn parser_should_accept_crlf_frontmatter_reordered_fields_and_field_whitespace() -> TestResult {
    let temporary = initialized_project()?;
    let path = quest_directory(temporary.path()).join(format!("{FIRST_ID}.md"));
    fs::write(
        &path,
        "---\r\n status : ready \r\n created_at : 2026-08-22T22:30:00+08:00 \r\n---\r\n\r\nBody\r\n",
    )?;

    let quest = open_workspace(temporary.path())?.get_quest(&QuestId::from_str(FIRST_ID)?)?;

    assert_eq!(quest.status, QuestStatus::Ready);
    assert_eq!(quest.content, "Body\r\n");
    Ok(())
}

#[test]
fn list_should_isolate_damaged_files_and_continue_loading_valid_quests() -> TestResult {
    let temporary = initialized_project()?;
    write_fixture(
        temporary.path(),
        FIRST_ID,
        "2026-08-22T22:30:00+08:00",
        "inbox",
        "Valid",
    )?;
    let damaged = quest_directory(temporary.path()).join(format!("{SECOND_ID}.md"));
    fs::write(
        &damaged,
        "---\ncreated_at: 2026-08-22T22:30:00+08:00\nstatus: inbox\ntags: bad\n---\n\nDamaged",
    )?;

    let collection = open_workspace(temporary.path())?.list_quests()?;

    assert_eq!(collection.quests.len(), 1);
    assert_eq!(collection.issues.len(), 1);
    assert_eq!(collection.issues[0].path, fs::canonicalize(damaged)?);
    Ok(())
}

#[test]
fn parser_should_isolate_duplicate_missing_invalid_and_non_utf8_fields() -> TestResult {
    let temporary = initialized_project()?;
    let fixtures = [
        (
            FIRST_ID,
            "---\ncreated_at: 2026-08-22T22:30:00+08:00\ncreated_at: 2026-08-22T22:30:00+08:00\nstatus: inbox\n---\n\nBody".as_bytes().to_vec(),
        ),
        (
            SECOND_ID,
            "---\ncreated_at: not-a-date\nstatus: inbox\n---\n\nBody".as_bytes().to_vec(),
        ),
        (
            THIRD_ID,
            "---\ncreated_at: 2026-08-22T22:30:00+08:00\nstatus: later\n---\n\nBody".as_bytes().to_vec(),
        ),
        (
            "sq_01ARZ3NDEKTSV4RRFFQ69G5FAY",
            "---\ncreated_at: 2026-08-22T22:30:00+08:00\n---\n\nBody"
                .as_bytes()
                .to_vec(),
        ),
        (
            "sq_01ARZ3NDEKTSV4RRFFQ69G5FAZ",
            vec![0xff, 0xfe, 0xfd],
        ),
    ];
    for (id, bytes) in fixtures {
        fs::write(
            quest_directory(temporary.path()).join(format!("{id}.md")),
            bytes,
        )?;
    }

    let collection = open_workspace(temporary.path())?.list_quests()?;

    assert!(collection.quests.is_empty());
    assert_eq!(collection.issues.len(), 5);
    Ok(())
}

#[test]
fn list_should_sort_by_creation_time_then_id_descending() -> TestResult {
    let temporary = initialized_project()?;
    write_fixture(
        temporary.path(),
        FIRST_ID,
        "2026-08-22T22:30:00+08:00",
        "inbox",
        "Older id",
    )?;
    write_fixture(
        temporary.path(),
        SECOND_ID,
        "2026-08-22T22:30:00+08:00",
        "ready",
        "Newer id",
    )?;
    write_fixture(
        temporary.path(),
        THIRD_ID,
        "2026-08-23T22:30:00+08:00",
        "done",
        "Newest time",
    )?;

    let collection = open_workspace(temporary.path())?.list_quests()?;
    let ids: Vec<String> = collection
        .quests
        .iter()
        .map(|quest| quest.id.to_string())
        .collect();

    assert_eq!(ids, [THIRD_ID, SECOND_ID, FIRST_ID]);
    Ok(())
}

#[test]
fn search_should_match_content_case_insensitively_and_preserve_issues() -> TestResult {
    let temporary = initialized_project()?;
    write_fixture(
        temporary.path(),
        FIRST_ID,
        "2026-08-22T22:30:00+08:00",
        "inbox",
        "Design Desktop MVP",
    )?;
    write_fixture(
        temporary.path(),
        SECOND_ID,
        "2026-08-23T22:30:00+08:00",
        "ready",
        "Document CLI output",
    )?;
    fs::write(
        quest_directory(temporary.path()).join("invalid-name.md"),
        "not a quest",
    )?;
    let workspace = open_workspace(temporary.path())?;

    let result = workspace.search_quests("desktop mvp")?;
    let empty = workspace.search_quests("")?;

    assert_eq!(result.quests.len(), 1);
    assert_eq!(result.quests[0].content, "Design Desktop MVP");
    assert_eq!(result.issues.len(), 1);
    assert_eq!(empty.quests.len(), 2);
    Ok(())
}

#[test]
fn list_should_ignore_non_markdown_and_temporary_files() -> TestResult {
    let temporary = initialized_project()?;
    let directory = quest_directory(temporary.path());
    fs::write(directory.join("notes.txt"), "ignored")?;
    fs::write(
        directory.join(format!(".{FIRST_ID}.md.temp.tmp")),
        "ignored",
    )?;

    let collection = open_workspace(temporary.path())?.list_quests()?;

    assert!(collection.quests.is_empty());
    assert!(collection.issues.is_empty());
    Ok(())
}

#[test]
fn atomic_updates_should_not_leave_temporary_files() -> TestResult {
    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let quest = workspace.create_quest(CreateQuest {
        content: "Original".to_owned(),
    })?;
    workspace.update_quest_content(&quest.id, "Updated".to_owned())?;

    let mut temporary_count = 0;
    for entry in fs::read_dir(quest_directory(temporary.path()))? {
        let filename = entry?.file_name();
        if filename.to_string_lossy().ends_with(".tmp") {
            temporary_count += 1;
        }
    }

    assert_eq!(temporary_count, 0);
    Ok(())
}

#[test]
fn delete_sidequest_data_should_preserve_project_root() -> TestResult {
    let temporary = initialized_project()?;
    let marker = temporary.path().join("keep.txt");
    fs::write(&marker, "keep")?;
    let workspace = open_workspace(temporary.path())?;

    workspace.delete_sidequest_data()?;

    assert!(temporary.path().is_dir());
    assert!(marker.is_file());
    assert!(!temporary.path().join(".sidequest").exists());
    Ok(())
}

#[cfg(unix)]
#[test]
fn workspace_should_reject_sidequest_symlinks() -> TestResult {
    use std::os::unix::fs::symlink;

    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    let external = temporary.path().join("external");
    fs::create_dir(&project)?;
    fs::create_dir(&external)?;
    symlink(&external, project.join(".sidequest"))?;

    assert!(matches!(
        open_workspace(&project),
        Err(Error::InvalidWorkspaceLayout { .. })
    ));
    assert!(matches!(
        init_workspace(&project),
        Err(Error::InvalidWorkspaceLayout { .. })
    ));
    Ok(())
}

#[cfg(unix)]
#[test]
fn quest_access_should_reject_a_symlinked_quest_directory() -> TestResult {
    use std::os::unix::fs::symlink;

    let temporary = TempDir::new()?;
    let project = temporary.path().join("project");
    let external = temporary.path().join("external");
    fs::create_dir(&project)?;
    fs::create_dir(project.join(".sidequest"))?;
    fs::create_dir(&external)?;
    symlink(&external, project.join(".sidequest/quests"))?;

    let workspace = open_workspace(&project)?;

    assert!(matches!(
        workspace.list_quests(),
        Err(Error::InvalidWorkspaceLayout { .. })
    ));
    Ok(())
}

#[cfg(unix)]
#[test]
fn delete_sidequest_data_should_reject_a_path_replaced_by_a_symlink() -> TestResult {
    use std::os::unix::fs::symlink;

    let temporary = initialized_project()?;
    let workspace = open_workspace(temporary.path())?;
    let sidequest = temporary.path().join(".sidequest");
    let original = temporary.path().join("original-sidequest");
    let external = temporary.path().join("external");
    fs::rename(&sidequest, &original)?;
    fs::create_dir(&external)?;
    symlink(&external, &sidequest)?;

    assert!(matches!(
        workspace.delete_sidequest_data(),
        Err(Error::UnsafeDeleteTarget { .. })
    ));
    assert!(external.is_dir());
    Ok(())
}

#[cfg(unix)]
#[test]
fn list_and_delete_should_reject_quest_symlinks_without_touching_target() -> TestResult {
    use std::os::unix::fs::symlink;

    let temporary = initialized_project()?;
    let external = temporary.path().join("external.md");
    fs::write(&external, "external")?;
    let linked = quest_directory(temporary.path()).join(format!("{FIRST_ID}.md"));
    symlink(&external, &linked)?;
    let workspace = open_workspace(temporary.path())?;
    let id = QuestId::from_str(FIRST_ID)?;

    let collection = workspace.list_quests()?;
    assert_eq!(collection.issues.len(), 1);
    assert!(matches!(
        workspace.delete_quest(&id),
        Err(Error::InvalidQuestFile { .. })
    ));
    assert!(external.is_file());
    Ok(())
}

#[test]
fn quest_id_and_status_should_parse_only_canonical_values() -> TestResult {
    let id = QuestId::from_str(FIRST_ID)?;

    assert_eq!(id.to_string(), FIRST_ID);
    assert_eq!(QuestStatus::from_str("inbox")?, QuestStatus::Inbox);
    assert_eq!(QuestStatus::from_str("ready")?, QuestStatus::Ready);
    assert_eq!(QuestStatus::from_str("done")?, QuestStatus::Done);
    assert!(matches!(
        QuestId::from_str("../quest"),
        Err(Error::InvalidQuestId { .. })
    ));
    assert!(matches!(
        QuestStatus::from_str("Ready"),
        Err(Error::InvalidQuestStatus { .. })
    ));
    Ok(())
}

fn initialized_project() -> std::io::Result<TempDir> {
    let temporary = TempDir::new()?;
    fs::create_dir(temporary.path().join(".sidequest"))?;
    fs::create_dir(quest_directory(temporary.path()))?;
    Ok(temporary)
}

fn quest_directory(project: &Path) -> PathBuf {
    project.join(".sidequest/quests")
}

fn write_fixture(
    project: &Path,
    id: &str,
    created_at: &str,
    status: &str,
    content: &str,
) -> std::io::Result<()> {
    fs::write(
        quest_directory(project).join(format!("{id}.md")),
        format!("---\ncreated_at: {created_at}\nstatus: {status}\n---\n\n{content}"),
    )
}
