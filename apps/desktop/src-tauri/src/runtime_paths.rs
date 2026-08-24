use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::{DesktopError, Result};

#[cfg(debug_assertions)]
const DEBUG_PROFILE_ENV: &str = "SIDEQUEST_DEBUG_PROFILE_DIR";

#[derive(Clone, Debug)]
pub(crate) struct RuntimePaths {
    app_data_directory: PathBuf,
    home_directory: PathBuf,
    log_directory: PathBuf,
    isolated: bool,
}

impl RuntimePaths {
    pub(crate) fn resolve(app: &AppHandle, profile_root: Option<&Path>) -> Result<Self> {
        if let Some(root) = profile_root {
            return Self::isolated(root);
        }

        let app_data_directory =
            app.path()
                .app_data_dir()
                .map_err(|error| DesktopError::Window {
                    operation: "resolve Desktop app data directory",
                    message: error.to_string(),
                })?;
        let home_directory = app
            .path()
            .home_dir()
            .map_err(|error| DesktopError::Window {
                operation: "resolve home directory",
                message: error.to_string(),
            })?;
        let log_directory = app
            .path()
            .app_log_dir()
            .map_err(|error| DesktopError::Window {
                operation: "resolve Desktop log directory",
                message: error.to_string(),
            })?;
        fs::create_dir_all(&log_directory).map_err(|source| {
            DesktopError::io("create Desktop log directory", &log_directory, source)
        })?;
        Ok(Self {
            app_data_directory,
            home_directory,
            log_directory,
            isolated: false,
        })
    }

    pub(crate) fn app_data_directory(&self) -> &Path {
        &self.app_data_directory
    }

    pub(crate) fn home_directory(&self) -> &Path {
        &self.home_directory
    }

    pub(crate) fn log_directory(&self) -> &Path {
        &self.log_directory
    }

    pub(crate) const fn is_isolated(&self) -> bool {
        self.isolated
    }

    fn isolated(root: &Path) -> Result<Self> {
        Ok(Self {
            app_data_directory: ensure_directory(&root.join("app-data"))?,
            home_directory: ensure_directory(&root.join("home"))?,
            log_directory: ensure_directory(&root.join("logs"))?,
            isolated: true,
        })
    }
}

#[cfg(debug_assertions)]
pub(crate) fn configured_debug_profile_root() -> io::Result<Option<PathBuf>> {
    let Some(value) = std::env::var_os(DEBUG_PROFILE_ENV) else {
        return Ok(None);
    };
    let path = PathBuf::from(value);
    prepare_debug_profile_root(&path).map(Some)
}

#[cfg(not(debug_assertions))]
pub(crate) fn configured_debug_profile_root() -> io::Result<Option<PathBuf>> {
    Ok(None)
}

#[cfg(debug_assertions)]
fn prepare_debug_profile_root(path: &Path) -> io::Result<PathBuf> {
    if !path.is_absolute() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{DEBUG_PROFILE_ENV} must be an absolute path"),
        ));
    }
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "debug profile root must not be a symlink",
            ));
        }
        Ok(metadata) if !metadata.is_dir() => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "debug profile root must be a directory",
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => fs::create_dir_all(path)?,
        Err(error) => return Err(error),
    }
    fs::canonicalize(path)
}

fn ensure_directory(path: &Path) -> Result<PathBuf> {
    fs::create_dir_all(path)
        .map_err(|source| DesktopError::io("create isolated profile directory", path, source))?;
    fs::canonicalize(path)
        .map_err(|source| DesktopError::io("canonicalize isolated profile directory", path, source))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use tempfile::TempDir;

    use super::{RuntimePaths, prepare_debug_profile_root};

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn profile_root_should_be_created_and_canonicalized() -> TestResult {
        let temporary = TempDir::new()?;
        let profile = temporary.path().join("profile");

        let resolved = prepare_debug_profile_root(&profile)?;

        assert_eq!(resolved, fs::canonicalize(profile)?);
        Ok(())
    }

    #[test]
    fn relative_profile_root_should_be_rejected() -> TestResult {
        let error = match prepare_debug_profile_root(Path::new("relative-profile")) {
            Ok(_) => return Err("relative profile unexpectedly succeeded".into()),
            Err(error) => error,
        };

        assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
        Ok(())
    }

    #[test]
    fn isolated_paths_should_stay_inside_the_profile() -> TestResult {
        let temporary = TempDir::new()?;
        let profile = prepare_debug_profile_root(&temporary.path().join("profile"))?;

        let paths = RuntimePaths::isolated(&profile)?;

        assert_eq!(paths.app_data_directory(), profile.join("app-data"));
        assert_eq!(paths.home_directory(), profile.join("home"));
        assert_eq!(paths.log_directory(), profile.join("logs"));
        assert!(paths.is_isolated());
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn symlink_profile_root_should_be_rejected() -> TestResult {
        use std::os::unix::fs::symlink;

        let temporary = TempDir::new()?;
        let target = temporary.path().join("target");
        let profile = temporary.path().join("profile");
        fs::create_dir(&target)?;
        symlink(&target, &profile)?;

        let error = match prepare_debug_profile_root(&profile) {
            Ok(_) => return Err("symlink profile unexpectedly succeeded".into()),
            Err(error) => error,
        };

        assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
        Ok(())
    }
}
