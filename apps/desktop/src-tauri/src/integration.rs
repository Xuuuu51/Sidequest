use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::app_state::{AppStateStore, ManagedArtifact, ManagedArtifactRecord};
use crate::dto::{IntegrationIdDto, IntegrationItemDto, IntegrationStateDto, display_path};
use crate::error::{DesktopError, Result};
use crate::logging::sanitize_path;
use crate::runtime_paths::RuntimePaths;

const BUNDLED_VERSION: &str = env!("CARGO_PKG_VERSION");

pub(crate) fn status(
    app: &AppHandle,
    store: &AppStateStore,
    paths: &RuntimePaths,
) -> Vec<IntegrationItemDto> {
    let home = paths.home_directory();
    let resources = resource_paths(app);
    vec![
        item_status(
            IntegrationIdDto::Cli,
            ManagedArtifact::Cli,
            &home.join(".local/bin/sq"),
            &resources.cli,
            store,
        ),
        item_status(
            IntegrationIdDto::Codex,
            ManagedArtifact::Codex,
            &home.join(".codex/skills/sidequest/SKILL.md"),
            &resources.skill,
            store,
        ),
        item_status(
            IntegrationIdDto::Claude,
            ManagedArtifact::Claude,
            &home.join(".claude/skills/sidequest/SKILL.md"),
            &resources.skill,
            store,
        ),
    ]
}

pub(crate) fn install_cli(
    app: &AppHandle,
    store: &mut AppStateStore,
    paths: &RuntimePaths,
) -> Result<()> {
    let home = paths.home_directory();
    let source = resource_paths(app).cli;
    let target = home.join(".local/bin/sq");
    log::info!(
        "installing managed CLI target={}",
        sanitize_path(&target, home)
    );
    let result = install_file(
        store,
        ManagedArtifact::Cli,
        &source,
        &target,
        true,
        Some(false),
    );
    if result.is_ok() {
        log::info!("managed CLI installation completed");
    }
    result
}

pub(crate) fn install_agent_skill(
    app: &AppHandle,
    store: &mut AppStateStore,
    agent: IntegrationIdDto,
    paths: &RuntimePaths,
) -> Result<()> {
    install_cli(app, store, paths)?;
    let home = paths.home_directory();
    let (artifact, target) = match agent {
        IntegrationIdDto::Codex => (
            ManagedArtifact::Codex,
            home.join(".codex/skills/sidequest/SKILL.md"),
        ),
        IntegrationIdDto::Claude => (
            ManagedArtifact::Claude,
            home.join(".claude/skills/sidequest/SKILL.md"),
        ),
        IntegrationIdDto::Cli => {
            return Err(DesktopError::IntegrationUnavailable {
                path: home.to_path_buf(),
                message: "CLI is not an agent skill".to_owned(),
            });
        }
    };
    log::info!(
        "installing managed agent skill target={}",
        sanitize_path(&target, home)
    );
    let result = install_file(
        store,
        artifact,
        &resource_paths(app).skill,
        &target,
        false,
        None,
    );
    if result.is_ok() {
        log::info!("managed agent skill installation completed");
    }
    result
}

pub(crate) fn uninstall(
    store: &mut AppStateStore,
    integration: IntegrationIdDto,
    paths: &RuntimePaths,
) -> Result<()> {
    let home = paths.home_directory();
    let (artifact, target, cli_intent) = match integration {
        IntegrationIdDto::Cli => (ManagedArtifact::Cli, home.join(".local/bin/sq"), Some(true)),
        IntegrationIdDto::Codex => (
            ManagedArtifact::Codex,
            home.join(".codex/skills/sidequest/SKILL.md"),
            None,
        ),
        IntegrationIdDto::Claude => (
            ManagedArtifact::Claude,
            home.join(".claude/skills/sidequest/SKILL.md"),
            None,
        ),
    };
    log::info!(
        "uninstalling managed integration target={}",
        sanitize_path(&target, home)
    );
    let result = uninstall_file(store, artifact, &target, cli_intent);
    if result.is_ok() {
        log::info!("managed integration uninstall completed");
    }
    result
}

pub(crate) fn auto_maintain_cli(
    app: &AppHandle,
    store: &mut AppStateStore,
    paths: &RuntimePaths,
) -> Result<()> {
    if !store.has_projects() || store.cli_user_uninstalled() {
        log::debug!("automatic CLI maintenance skipped");
        return Ok(());
    }
    let current = status(app, store, paths)
        .into_iter()
        .find(|item| item.id == IntegrationIdDto::Cli)
        .ok_or_else(|| DesktopError::IntegrationUnavailable {
            path: PathBuf::from("~/.local/bin/sq"),
            message: "CLI status is unavailable".to_owned(),
        })?;
    if matches!(
        current.state,
        IntegrationStateDto::NotInstalled | IntegrationStateDto::UpdateAvailable
    ) || (current.state == IntegrationStateDto::RepairRequired
        && current.message.as_deref() == Some("Managed item is missing"))
    {
        log::info!("automatic CLI maintenance requested an install or upgrade");
        install_cli(app, store, paths)?;
    }
    Ok(())
}

struct ResourcePaths {
    cli: PathBuf,
    skill: PathBuf,
}

fn resource_paths(app: &AppHandle) -> ResourcePaths {
    let root = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("resources"));
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
    let bundled_cli = root.join("sq");
    let bundled_skill = root.join("sidequest-skill/SKILL.md");
    ResourcePaths {
        cli: if bundled_cli.is_file() {
            bundled_cli
        } else {
            development.join("sq")
        },
        skill: if bundled_skill.is_file() {
            bundled_skill
        } else {
            development.join("sidequest-skill/SKILL.md")
        },
    }
}

fn item_status(
    id: IntegrationIdDto,
    artifact: ManagedArtifact,
    target: &Path,
    source: &Path,
    store: &AppStateStore,
) -> IntegrationItemDto {
    let record = store.integration_record(artifact);
    let result = inspect_item(target, source, record.as_ref());
    let (state, installed_version, mut message) = match result {
        Ok(value) => value,
        Err(error) => (
            IntegrationStateDto::Unavailable,
            record.as_ref().map(|value| value.version.clone()),
            Some(error.to_string()),
        ),
    };
    if id == IntegrationIdDto::Cli
        && state == IntegrationStateDto::Installed
        && !path_contains(target.parent())
    {
        message = Some("Add ~/.local/bin to PATH to run sq from Terminal".to_owned());
    }
    IntegrationItemDto {
        id,
        state,
        path: display_path(target),
        installed_version,
        bundled_version: BUNDLED_VERSION.to_owned(),
        message,
    }
}

fn inspect_item(
    target: &Path,
    source: &Path,
    record: Option<&ManagedArtifactRecord>,
) -> Result<(IntegrationStateDto, Option<String>, Option<String>)> {
    let target_metadata = fs::symlink_metadata(target);
    let Some(record) = record else {
        return match target_metadata {
            Ok(_) => Ok((
                IntegrationStateDto::Conflict,
                None,
                Some("An existing unowned item will not be overwritten".to_owned()),
            )),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                Ok((IntegrationStateDto::NotInstalled, None, None))
            }
            Err(error) => Err(DesktopError::io("inspect integration", target, error)),
        };
    };
    if record.path != target {
        return Ok((
            IntegrationStateDto::Conflict,
            Some(record.version.clone()),
            Some("Recorded ownership does not match the installation path".to_owned()),
        ));
    }
    let metadata = match target_metadata {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok((
                IntegrationStateDto::RepairRequired,
                Some(record.version.clone()),
                Some("Managed item is missing".to_owned()),
            ));
        }
        Err(error) => return Err(DesktopError::io("inspect integration", target, error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Ok((
            IntegrationStateDto::Conflict,
            Some(record.version.clone()),
            Some("Managed path is not a regular file".to_owned()),
        ));
    }
    let current_hash = hash_file(target)?;
    if current_hash != record.sha256 {
        return Ok((
            IntegrationStateDto::RepairRequired,
            Some(record.version.clone()),
            Some("Managed item was modified".to_owned()),
        ));
    }
    let bundled_hash = hash_file(source)?;
    if record.version != BUNDLED_VERSION || current_hash != bundled_hash {
        return Ok((
            IntegrationStateDto::UpdateAvailable,
            Some(record.version.clone()),
            None,
        ));
    }
    Ok((
        IntegrationStateDto::Installed,
        Some(record.version.clone()),
        None,
    ))
}

fn install_file(
    store: &mut AppStateStore,
    artifact: ManagedArtifact,
    source: &Path,
    target: &Path,
    executable: bool,
    cli_user_uninstalled: Option<bool>,
) -> Result<()> {
    ensure_regular_source(source)?;
    let source_hash = hash_file(source)?;
    let record = store.integration_record(artifact);
    if fs::symlink_metadata(target).is_ok() && record.is_none() {
        return Err(DesktopError::IntegrationConflict {
            path: target.to_path_buf(),
            message: "existing item is not owned by Sidequest".to_owned(),
        });
    }
    if let Ok(metadata) = fs::symlink_metadata(target)
        && (metadata.file_type().is_symlink() || !metadata.is_file())
    {
        return Err(DesktopError::IntegrationConflict {
            path: target.to_path_buf(),
            message: "target is not a regular file".to_owned(),
        });
    }
    let parent = target
        .parent()
        .ok_or_else(|| DesktopError::IntegrationUnavailable {
            path: target.to_path_buf(),
            message: "installation path has no parent directory".to_owned(),
        })?;
    fs::create_dir_all(parent)
        .map_err(|source| DesktopError::io("create integration directory", parent, source))?;
    let staged = sibling_path(target, "stage");
    let backup = sibling_path(target, "backup");
    if let Err(error) = copy_synced(source, &staged, executable) {
        if let Err(cleanup_error) = fs::remove_file(&staged)
            && cleanup_error.kind() != io::ErrorKind::NotFound
        {
            log::warn!("could not clean staged integration after copy failure: {cleanup_error}");
        }
        return Err(error);
    }
    let had_target = target.exists();
    if had_target {
        fs::rename(target, &backup)
            .map_err(|source| DesktopError::io("stage existing integration", target, source))?;
    }
    if let Err(error) = fs::rename(&staged, target) {
        let restore_result = if had_target {
            fs::rename(&backup, target)
        } else {
            Ok(())
        };
        if let Err(restore_error) = restore_result {
            log::error!("could not restore integration after install failure: {restore_error}");
        }
        if let Err(cleanup_error) = fs::remove_file(&staged)
            && cleanup_error.kind() != io::ErrorKind::NotFound
        {
            log::warn!("could not clean staged integration after install failure: {cleanup_error}");
        }
        return Err(DesktopError::io("install integration", target, error));
    }
    let next_record = ManagedArtifactRecord {
        path: target.to_path_buf(),
        version: BUNDLED_VERSION.to_owned(),
        sha256: source_hash,
    };
    if let Err(error) =
        store.set_integration_record(artifact, Some(next_record), cli_user_uninstalled)
    {
        if let Err(remove_error) = fs::remove_file(target)
            && remove_error.kind() != io::ErrorKind::NotFound
        {
            log::error!("could not remove failed managed integration: {remove_error}");
        }
        if had_target && let Err(restore_error) = fs::rename(&backup, target) {
            log::error!("could not restore integration after state write failure: {restore_error}");
        }
        return Err(error);
    }
    if had_target && let Err(error) = fs::remove_file(&backup) {
        log::warn!("could not clean integration backup: {error}");
    }
    sync_directory(parent)
}

fn uninstall_file(
    store: &mut AppStateStore,
    artifact: ManagedArtifact,
    target: &Path,
    cli_user_uninstalled: Option<bool>,
) -> Result<()> {
    let record = store.integration_record(artifact);
    if record.as_ref().is_some_and(|value| value.path != target) {
        return Err(DesktopError::IntegrationConflict {
            path: target.to_path_buf(),
            message: "recorded ownership does not match this path".to_owned(),
        });
    }
    if record.is_none() && target.exists() {
        return Err(DesktopError::IntegrationConflict {
            path: target.to_path_buf(),
            message: "existing item is not owned by Sidequest".to_owned(),
        });
    }
    if let Ok(metadata) = fs::symlink_metadata(target)
        && metadata.file_type().is_symlink()
    {
        return Err(DesktopError::IntegrationConflict {
            path: target.to_path_buf(),
            message: "refusing to remove a symlink".to_owned(),
        });
    }
    let backup = sibling_path(target, "remove");
    let existed = target.exists();
    if existed {
        fs::rename(target, &backup)
            .map_err(|source| DesktopError::io("stage integration removal", target, source))?;
    }
    if let Err(error) = store.set_integration_record(artifact, None, cli_user_uninstalled) {
        if existed && let Err(restore_error) = fs::rename(&backup, target) {
            log::error!("could not restore integration removal: {restore_error}");
        }
        return Err(error);
    }
    if existed {
        fs::remove_file(&backup)
            .map_err(|source| DesktopError::io("remove integration", &backup, source))?;
    }
    if let Some(parent) = target.parent() {
        sync_directory(parent)?;
    }
    Ok(())
}

fn ensure_regular_source(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|source| DesktopError::io("inspect bundled integration", path, source))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(DesktopError::IntegrationUnavailable {
            path: path.to_path_buf(),
            message: "bundled resource is not a regular file".to_owned(),
        });
    }
    Ok(())
}

fn copy_synced(source: &Path, target: &Path, executable: bool) -> Result<()> {
    let mut input = File::open(source)
        .map_err(|error| DesktopError::io("open bundled integration", source, error))?;
    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(target)
        .map_err(|error| DesktopError::io("create staged integration", target, error))?;
    io::copy(&mut input, &mut output)
        .map_err(|error| DesktopError::io("write staged integration", target, error))?;
    output
        .flush()
        .map_err(|error| DesktopError::io("flush staged integration", target, error))?;
    output
        .sync_all()
        .map_err(|error| DesktopError::io("sync staged integration", target, error))?;
    #[cfg(unix)]
    if executable {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(target, fs::Permissions::from_mode(0o755))
            .map_err(|error| DesktopError::io("mark integration executable", target, error))?;
    }
    Ok(())
}

fn hash_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)
        .map_err(|source| DesktopError::io("open integration for hashing", path, source))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|source| DesktopError::io("hash integration", path, source))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn sibling_path(target: &Path, kind: &str) -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("sidequest");
    target.with_file_name(format!(".{name}.{kind}-{}-{suffix}", std::process::id()))
}

fn sync_directory(path: &Path) -> Result<()> {
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|source| DesktopError::io("sync integration directory", path, source))
}

fn path_contains(directory: Option<&Path>) -> bool {
    let Some(directory) = directory else {
        return false;
    };
    std::env::var_os("PATH")
        .is_some_and(|path| std::env::split_paths(&path).any(|item| item == directory))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::*;

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn unowned_existing_target_should_be_reported_as_conflict() -> TestResult {
        let data = TempDir::new()?;
        let files = TempDir::new()?;
        let source = files.path().join("bundled");
        let target = files.path().join("sq");
        fs::write(&source, "bundled")?;
        fs::write(&target, "external")?;
        let store = AppStateStore::load(data.path())?;

        let (state, _, _) = inspect_item(
            &target,
            &source,
            store.integration_record(ManagedArtifact::Cli).as_ref(),
        )?;

        assert_eq!(state, IntegrationStateDto::Conflict);
        Ok(())
    }

    #[test]
    fn managed_file_should_install_detect_modification_and_uninstall() -> TestResult {
        let data = TempDir::new()?;
        let files = TempDir::new()?;
        let source = files.path().join("bundled");
        let target = files.path().join("bin/sq");
        fs::write(&source, "bundled")?;
        let mut store = AppStateStore::load(data.path())?;

        install_file(
            &mut store,
            ManagedArtifact::Cli,
            &source,
            &target,
            true,
            Some(false),
        )?;
        let record = store.integration_record(ManagedArtifact::Cli);
        let (installed, _, _) = inspect_item(&target, &source, record.as_ref())?;
        fs::write(&target, "modified")?;
        let (modified, _, _) = inspect_item(&target, &source, record.as_ref())?;
        uninstall_file(&mut store, ManagedArtifact::Cli, &target, Some(true))?;
        let restored = AppStateStore::load(data.path())?;

        assert_eq!(installed, IntegrationStateDto::Installed);
        assert_eq!(modified, IntegrationStateDto::RepairRequired);
        assert!(!target.exists());
        assert!(restored.cli_user_uninstalled());
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn installer_should_refuse_a_symlink_target() -> TestResult {
        use std::os::unix::fs::symlink;

        let data = TempDir::new()?;
        let files = TempDir::new()?;
        let source = files.path().join("bundled");
        let external = files.path().join("external");
        let target = files.path().join("sq");
        fs::write(&source, "bundled")?;
        fs::write(&external, "external")?;
        symlink(&external, &target)?;
        let mut store = AppStateStore::load(data.path())?;

        let result = install_file(
            &mut store,
            ManagedArtifact::Cli,
            &source,
            &target,
            true,
            Some(false),
        );

        assert!(matches!(
            result,
            Err(DesktopError::IntegrationConflict { .. })
        ));
        assert_eq!(fs::read_to_string(external)?, "external");
        Ok(())
    }
}
