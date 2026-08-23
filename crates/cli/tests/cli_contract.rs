//! Public command-line contract tests for the `sq` executable.

use std::error::Error as StdError;
use std::fs;
use std::io::{self, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::{Command, Output, Stdio};

use serde_json::Value;
use tempfile::TempDir;

type TestResult = std::result::Result<(), Box<dyn StdError>>;

const MISSING_ID: &str = "sq_01ARZ3NDEKTSV4RRFFQ69G5FAV";

#[test]
fn help_and_version_should_exit_successfully() -> TestResult {
    let help = sq().arg("--help").output()?;
    let version = sq().arg("--version").output()?;

    assert!(help.status.success());
    assert!(String::from_utf8(help.stdout)?.contains("Usage:"));
    assert!(version.status.success());
    assert!(String::from_utf8(version.stdout)?.starts_with("sq 0.1.0"));
    Ok(())
}

#[test]
fn init_json_should_return_schema_and_canonical_workspace() -> TestResult {
    let temporary = TempDir::new()?;
    let output = sq()
        .args(["--json", "init"])
        .arg(temporary.path())
        .output()?;
    let response: Value = serde_json::from_slice(&output.stdout)?;

    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty());
    assert_eq!(response["schema_version"], 1);
    assert_eq!(
        response["workspace"],
        fs::canonicalize(temporary.path())?
            .to_string_lossy()
            .as_ref()
    );
    assert!(temporary.path().join(".sidequest/quests").is_dir());
    Ok(())
}

#[test]
fn init_should_reject_global_workspace_with_json_error() -> TestResult {
    let temporary = TempDir::new()?;
    let output = sq()
        .arg("--json")
        .arg("--workspace")
        .arg(temporary.path())
        .arg("init")
        .arg(temporary.path())
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    assert_eq!(error["error"]["code"], "invalid_arguments");
    assert!(error["error"]["path"].is_null());
    Ok(())
}

#[test]
fn add_and_show_should_resolve_workspace_from_a_nested_directory() -> TestResult {
    let temporary = initialized_project()?;
    let nested = temporary.path().join("src/nested");
    fs::create_dir_all(&nested)?;
    let added = sq()
        .current_dir(&nested)
        .args(["--json", "add", "Remember this"])
        .output()?;
    let added_json: Value = serde_json::from_slice(&added.stdout)?;
    let id = json_string(&added_json["quest"]["id"])?;

    let shown = sq()
        .current_dir(&nested)
        .args(["--json", "show", &id])
        .output()?;
    let shown_json: Value = serde_json::from_slice(&shown.stdout)?;

    assert_eq!(shown.status.code(), Some(0));
    assert_eq!(shown_json["quest"]["id"], id);
    assert_eq!(shown_json["quest"]["content"], "Remember this");
    assert_eq!(shown_json["quest"]["status"], "inbox");
    Ok(())
}

#[test]
fn stdin_update_and_status_should_return_persisted_quest_dtos() -> TestResult {
    let temporary = initialized_project()?;
    let added = add_json(temporary.path(), "Original")?;
    let id = json_string(&added["quest"]["id"])?;

    let mut update = sq();
    update
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "update", &id, "--stdin"]);
    let updated = execute_with_input(update, "Updated\nfrom stdin\n")?;
    let updated_json: Value = serde_json::from_slice(&updated.stdout)?;

    let status = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "status", &id, "ready"])
        .output()?;
    let status_json: Value = serde_json::from_slice(&status.stdout)?;

    assert_eq!(updated.status.code(), Some(0));
    assert_eq!(updated_json["quest"]["content"], "Updated\nfrom stdin\n");
    assert_eq!(status.status.code(), Some(0));
    assert_eq!(status_json["quest"]["status"], "ready");
    Ok(())
}

#[test]
fn add_should_reject_content_and_stdin_together_as_json() -> TestResult {
    let temporary = initialized_project()?;
    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "add", "content", "--stdin"])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    assert_eq!(error["error"]["code"], "invalid_arguments");
    Ok(())
}

#[test]
fn blank_stdin_content_should_return_invalid_content() -> TestResult {
    let temporary = initialized_project()?;
    let mut command = sq();
    command
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "add", "--stdin"]);
    let output = execute_with_input(command, " \n\t")?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    assert_eq!(error["error"]["code"], "invalid_content");
    Ok(())
}

#[test]
fn list_should_default_to_active_statuses_and_support_all_and_status_filters() -> TestResult {
    let temporary = initialized_project()?;
    let inbox = add_json(temporary.path(), "Inbox")?;
    let ready = add_json(temporary.path(), "Ready")?;
    let done = add_json(temporary.path(), "Done")?;
    set_status(
        temporary.path(),
        &json_string(&ready["quest"]["id"])?,
        "ready",
    )?;
    set_status(
        temporary.path(),
        &json_string(&done["quest"]["id"])?,
        "done",
    )?;

    let default = list_json(temporary.path(), &[])?;
    let all = list_json(temporary.path(), &["--all"])?;
    let done_only = list_json(temporary.path(), &["--status", "done"])?;
    let active = list_json(
        temporary.path(),
        &["--status", "inbox", "--status", "ready"],
    )?;

    assert_eq!(array_length(&default["quests"])?, 2);
    assert_eq!(array_length(&all["quests"])?, 3);
    assert_eq!(array_length(&done_only["quests"])?, 1);
    assert_eq!(array_length(&active["quests"])?, 2);
    assert_eq!(done_only["quests"][0]["status"], "done");
    assert_eq!(inbox["quest"]["status"], "inbox");
    Ok(())
}

#[test]
fn list_should_reject_all_with_status() -> TestResult {
    let temporary = initialized_project()?;
    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "list", "--all", "--status", "done"])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(2));
    assert_eq!(error["error"]["code"], "invalid_arguments");
    Ok(())
}

#[test]
fn search_should_match_case_insensitively_filter_status_and_reject_blank_query() -> TestResult {
    let temporary = initialized_project()?;
    let first = add_json(temporary.path(), "Design Desktop MVP")?;
    let second = add_json(temporary.path(), "DESIGN CLI output")?;
    set_status(
        temporary.path(),
        &json_string(&second["quest"]["id"])?,
        "done",
    )?;

    let result = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "search", "design", "--status", "done"])
        .output()?;
    let result_json: Value = serde_json::from_slice(&result.stdout)?;
    let blank = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "search", "   "])
        .output()?;
    let blank_json: Value = serde_json::from_slice(&blank.stderr)?;

    assert_eq!(result.status.code(), Some(0));
    assert_eq!(array_length(&result_json["quests"])?, 1);
    assert_eq!(result_json["quests"][0]["status"], "done");
    assert_eq!(blank.status.code(), Some(2));
    assert_eq!(blank_json["error"]["code"], "invalid_arguments");
    assert_eq!(first["quest"]["status"], "inbox");
    Ok(())
}

#[test]
fn list_json_should_return_valid_quests_and_isolated_issues_with_exit_zero() -> TestResult {
    let temporary = initialized_project()?;
    add_json(temporary.path(), "Valid")?;
    fs::write(
        temporary.path().join(".sidequest/quests/invalid-name.md"),
        "damaged",
    )?;

    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "list", "--all"])
        .output()?;
    let response: Value = serde_json::from_slice(&output.stdout)?;

    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty());
    assert_eq!(array_length(&response["quests"])?, 1);
    assert_eq!(array_length(&response["issues"])?, 1);
    assert!(response["issues"][0]["path"].is_string());
    Ok(())
}

#[test]
fn missing_workspace_should_return_exit_three_and_json_error() -> TestResult {
    let temporary = TempDir::new()?;
    let output = sq()
        .current_dir(temporary.path())
        .args(["--json", "list"])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    assert_eq!(error["error"]["code"], "workspace_not_found");
    assert!(error["error"]["path"].is_string());
    Ok(())
}

#[test]
fn explicit_workspace_should_not_resolve_parent_directories() -> TestResult {
    let temporary = initialized_project()?;
    let nested = temporary.path().join("src/nested");
    fs::create_dir_all(&nested)?;

    let output = sq()
        .arg("--workspace")
        .arg(&nested)
        .args(["--json", "list"])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(3));
    assert!(output.stdout.is_empty());
    assert_eq!(error["error"]["code"], "workspace_not_found");
    Ok(())
}

#[test]
fn missing_quest_should_return_exit_four() -> TestResult {
    let temporary = initialized_project()?;
    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "show", MISSING_ID])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(4));
    assert_eq!(error["error"]["code"], "quest_not_found");
    Ok(())
}

#[test]
fn damaged_specific_quest_should_return_exit_six() -> TestResult {
    let temporary = initialized_project()?;
    fs::write(
        temporary
            .path()
            .join(format!(".sidequest/quests/{MISSING_ID}.md")),
        "damaged",
    )?;
    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "show", MISSING_ID])
        .output()?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(6));
    assert_eq!(error["error"]["code"], "quest_file_invalid");
    assert!(error["error"]["path"].is_string());
    Ok(())
}

#[test]
fn json_delete_should_require_yes_then_return_deleted_dto() -> TestResult {
    let temporary = initialized_project()?;
    let added = add_json(temporary.path(), "Delete me")?;
    let id = json_string(&added["quest"]["id"])?;

    let required = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "delete", &id])
        .output()?;
    let required_json: Value = serde_json::from_slice(&required.stderr)?;
    let deleted = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "delete", &id, "--yes"])
        .output()?;
    let deleted_json: Value = serde_json::from_slice(&deleted.stdout)?;

    assert_eq!(required.status.code(), Some(2));
    assert!(required.stdout.is_empty());
    assert_eq!(required_json["error"]["code"], "confirmation_required");
    assert_eq!(deleted.status.code(), Some(0));
    assert_eq!(deleted_json["deleted"]["id"], id);
    Ok(())
}

#[test]
fn human_delete_no_should_cancel_with_exit_zero_and_keep_quest() -> TestResult {
    let temporary = initialized_project()?;
    let added = add_json(temporary.path(), "Keep me")?;
    let id = json_string(&added["quest"]["id"])?;
    let mut delete = sq();
    delete
        .arg("--workspace")
        .arg(temporary.path())
        .args(["delete", &id]);

    let cancelled = execute_with_input(delete, "n\n")?;
    let shown = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "show", &id])
        .output()?;

    assert_eq!(cancelled.status.code(), Some(0));
    assert!(String::from_utf8(cancelled.stderr)?.contains("Cancelled"));
    assert_eq!(shown.status.code(), Some(0));
    Ok(())
}

#[test]
fn human_delete_eof_should_cancel_with_exit_zero() -> TestResult {
    let temporary = initialized_project()?;
    let added = add_json(temporary.path(), "Keep me")?;
    let id = json_string(&added["quest"]["id"])?;

    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["delete", &id])
        .stdin(Stdio::null())
        .output()?;

    assert_eq!(output.status.code(), Some(0));
    assert!(String::from_utf8(output.stderr)?.contains("Cancelled"));
    Ok(())
}

#[test]
fn human_delete_yes_should_remove_quest() -> TestResult {
    let temporary = initialized_project()?;
    let added = add_json(temporary.path(), "Delete me")?;
    let id = json_string(&added["quest"]["id"])?;
    let mut delete = sq();
    delete
        .arg("--workspace")
        .arg(temporary.path())
        .args(["delete", &id]);

    let deleted = execute_with_input(delete, "yes\n")?;
    let shown = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "show", &id])
        .output()?;

    assert_eq!(deleted.status.code(), Some(0));
    assert_eq!(shown.status.code(), Some(4));
    Ok(())
}

#[cfg(unix)]
#[test]
fn read_only_workspace_should_return_exit_five() -> TestResult {
    let temporary = initialized_project()?;
    let quests = temporary.path().join(".sidequest/quests");
    let original_permissions = fs::metadata(&quests)?.permissions();
    fs::set_permissions(&quests, fs::Permissions::from_mode(0o555))?;

    let output = sq()
        .arg("--workspace")
        .arg(temporary.path())
        .args(["--json", "add", "Cannot write"])
        .output()?;
    fs::set_permissions(&quests, original_permissions)?;
    let error: Value = serde_json::from_slice(&output.stderr)?;

    assert_eq!(output.status.code(), Some(5));
    assert_eq!(error["error"]["code"], "workspace_read_only");
    Ok(())
}

fn sq() -> Command {
    Command::new(env!("CARGO_BIN_EXE_sq"))
}

fn initialized_project() -> std::result::Result<TempDir, Box<dyn StdError>> {
    let temporary = TempDir::new()?;
    let output = sq().arg("init").arg(temporary.path()).output()?;
    if !output.status.success() {
        return Err(io::Error::other(String::from_utf8_lossy(&output.stderr)).into());
    }
    Ok(temporary)
}

fn add_json(project: &Path, content: &str) -> std::result::Result<Value, Box<dyn StdError>> {
    let output = sq()
        .arg("--workspace")
        .arg(project)
        .args(["--json", "add", content])
        .output()?;
    if !output.status.success() {
        return Err(io::Error::other(String::from_utf8_lossy(&output.stderr)).into());
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}

fn set_status(project: &Path, id: &str, status: &str) -> io::Result<()> {
    let output = sq()
        .arg("--workspace")
        .arg(project)
        .args(["status", id, status])
        .output()?;
    if output.status.success() {
        Ok(())
    } else {
        Err(io::Error::other(String::from_utf8_lossy(&output.stderr)))
    }
}

fn list_json(project: &Path, extra: &[&str]) -> std::result::Result<Value, Box<dyn StdError>> {
    let mut command = sq();
    command
        .arg("--workspace")
        .arg(project)
        .args(["--json", "list"])
        .args(extra);
    let output = command.output()?;
    if !output.status.success() {
        return Err(io::Error::other(String::from_utf8_lossy(&output.stderr)).into());
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}

fn execute_with_input(mut command: Command, input: &str) -> io::Result<Output> {
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let Some(mut stdin) = child.stdin.take() else {
        return Err(io::Error::other("child stdin was not piped"));
    };
    stdin.write_all(input.as_bytes())?;
    drop(stdin);
    child.wait_with_output()
}

fn json_string(value: &Value) -> std::result::Result<String, Box<dyn StdError>> {
    value
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| io::Error::other("expected JSON string").into())
}

fn array_length(value: &Value) -> std::result::Result<usize, Box<dyn StdError>> {
    value
        .as_array()
        .map(Vec::len)
        .ok_or_else(|| io::Error::other("expected JSON array").into())
}
