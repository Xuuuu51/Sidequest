use std::path::{Path, PathBuf};

use chrono::Local;
use log::LevelFilter;
use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

const LOG_FILE_STEM: &str = "sidequest";
const MAX_LOG_FILE_SIZE: u128 = 1_000_000;

pub(crate) fn plugin<R: Runtime>(profile_root: Option<&Path>) -> TauriPlugin<R> {
    let home = profile_root
        .map(|root| root.join("home"))
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from));
    let file_target = profile_root.map_or(
        TargetKind::LogDir {
            file_name: Some(LOG_FILE_STEM.to_owned()),
        },
        |root| TargetKind::Folder {
            path: root.join("logs"),
            file_name: Some(LOG_FILE_STEM.to_owned()),
        },
    );
    tauri_plugin_log::Builder::new()
        .clear_targets()
        .targets([Target::new(TargetKind::Stdout), Target::new(file_target)])
        .level(if cfg!(debug_assertions) {
            LevelFilter::Debug
        } else {
            LevelFilter::Info
        })
        .format(move |out, message, record| {
            let message = sanitize_message(&message.to_string(), home.as_deref());
            out.finish(format_args!(
                "[{}][{}][{}] {}",
                Local::now().format("%Y-%m-%d][%H:%M:%S"),
                record.target(),
                record.level(),
                message
            ));
        })
        .max_file_size(MAX_LOG_FILE_SIZE)
        .rotation_strategy(RotationStrategy::KeepSome(1))
        .build()
}

fn sanitize_message(message: &str, home: Option<&Path>) -> String {
    let Some(home) = home.and_then(Path::to_str).filter(|home| !home.is_empty()) else {
        return message.to_owned();
    };
    message.replace(home, "~")
}

pub(crate) fn sanitize_path(path: &Path, home: &Path) -> String {
    path.strip_prefix(home).map_or_else(
        |_| path.display().to_string(),
        |relative| {
            if relative.as_os_str().is_empty() {
                "~".to_owned()
            } else {
                PathBuf::from("~").join(relative).display().to_string()
            }
        },
    )
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{sanitize_message, sanitize_path};

    #[test]
    fn home_prefix_should_be_redacted() {
        let path = Path::new("/Users/developer/Projects/Sidequest");

        let display = sanitize_path(path, Path::new("/Users/developer"));

        assert_eq!(display, "~/Projects/Sidequest");
    }

    #[test]
    fn unrelated_path_should_be_preserved() {
        let path = Path::new("/Volumes/Work/Sidequest");

        let display = sanitize_path(path, Path::new("/Users/developer"));

        assert_eq!(display, "/Volumes/Work/Sidequest");
    }

    #[test]
    fn log_messages_should_redact_every_home_path() {
        let message = "copy /Users/developer/a to /Users/developer/b failed";

        let sanitized = sanitize_message(message, Some(Path::new("/Users/developer")));

        assert_eq!(sanitized, "copy ~/a to ~/b failed");
    }
}
