use std::path::Path;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::dto::{WorkspaceInvalidatedDto, display_path};
use crate::error::{DesktopError, Result};

pub(crate) const WORKSPACE_INVALIDATED_EVENT: &str = "workspace-invalidated";

#[derive(Default)]
pub(crate) struct ProjectWatcher {
    active: Option<ActiveWatcher>,
}

struct ActiveWatcher {
    _watcher: RecommendedWatcher,
}

impl ProjectWatcher {
    pub(crate) fn replace(
        &mut self,
        app_handle: &AppHandle,
        project_path: Option<&Path>,
    ) -> Result<()> {
        let emitted_project_path = project_path.map(Path::to_path_buf);
        let emitted_app_handle = app_handle.clone();
        self.replace_with_handler(project_path, move || {
            if let Some(project_path) = &emitted_project_path {
                if let Err(error) = emitted_app_handle.emit(
                    WORKSPACE_INVALIDATED_EVENT,
                    WorkspaceInvalidatedDto {
                        project_path: display_path(project_path),
                    },
                ) {
                    log::error!("watcher could not emit workspace invalidation: {error}");
                } else {
                    log::debug!("watcher emitted workspace invalidation");
                }
            }
        })
    }

    fn replace_with_handler(
        &mut self,
        project_path: Option<&Path>,
        handler: impl Fn() + Send + 'static,
    ) -> Result<()> {
        self.active = None;
        let Some(project_path) = project_path else {
            log::debug!("workspace watcher stopped");
            return Ok(());
        };
        let quests_path = project_path.join(".sidequest/quests");
        let watched_path = quests_path.clone();
        let mut watcher =
            notify::recommended_watcher(move |event: notify::Result<notify::Event>| match event {
                Ok(event)
                    if event
                        .paths
                        .iter()
                        .any(|path| is_relevant_path(path, &watched_path)) =>
                {
                    handler()
                }
                Ok(_) => {}
                Err(error) => log::warn!("workspace watcher event failed: {error}"),
            })
            .map_err(|source| DesktopError::Watcher {
                path: quests_path.clone(),
                message: source.to_string(),
            })?;
        watcher
            .watch(&quests_path, RecursiveMode::NonRecursive)
            .map_err(|source| DesktopError::Watcher {
                path: quests_path,
                message: source.to_string(),
            })?;
        self.active = Some(ActiveWatcher { _watcher: watcher });
        log::info!("workspace watcher started");
        Ok(())
    }
}

fn is_relevant_path(path: &Path, watched_directory: &Path) -> bool {
    path == watched_directory || path.extension().is_some_and(|extension| extension == "md")
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::{ProjectWatcher, is_relevant_path};

    type TestResult = std::result::Result<(), Box<dyn std::error::Error>>;

    #[test]
    fn watcher_should_replace_and_clear_the_active_project() -> TestResult {
        let project = TempDir::new()?;
        sidequest_core::init_workspace(project.path())?;
        let mut watcher = ProjectWatcher::default();
        watcher.replace_with_handler(Some(project.path()), || {})?;

        assert!(watcher.active.is_some());
        watcher.replace_with_handler(None, || {})?;
        assert!(watcher.active.is_none());
        Ok(())
    }

    #[test]
    fn watcher_should_ignore_access_probes_and_atomic_temporary_files() {
        let quests = std::path::Path::new("/project/.sidequest/quests");

        assert!(is_relevant_path(&quests.join("sq_quest.md"), quests));
        assert!(is_relevant_path(quests, quests));
        assert!(!is_relevant_path(
            &quests.join(".sidequest-access-id.tmp"),
            quests
        ));
        assert!(!is_relevant_path(
            &quests.join(".sq_quest.md.id.tmp"),
            quests
        ));
    }
}
