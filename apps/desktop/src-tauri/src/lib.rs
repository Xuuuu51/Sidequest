//! Native application entry point for Sidequest Desktop.

mod app_menu;
mod app_state;
mod commands;
mod diagnostics;
mod dto;
mod error;
mod integration;
mod locale;
mod logging;
mod native_events;
mod quick_capture_window;
mod runtime_paths;
mod shortcut;
mod watcher;
mod window_state;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

use crate::app_state::{AppStateStore, DesktopState};
use crate::integration::auto_maintain_cli;
use crate::quick_capture_window::{
    QUICK_CAPTURE_WINDOW_LABEL, restore_quick_capture_window, show_quick_capture_window,
};
use crate::runtime_paths::{RuntimePaths, configured_debug_profile_root};
use crate::shortcut::ShortcutManager;
use crate::window_state::restore_main_window;

/// Runs the Sidequest desktop application.
///
/// # Errors
///
/// Returns a Tauri error when application setup or the native event loop fails.
pub fn run() -> tauri::Result<()> {
    let profile_root = configured_debug_profile_root().map_err(tauri::Error::Io)?;
    let setup_profile_root = profile_root.clone();
    let app = tauri::Builder::default()
        .menu(app_menu::build)
        .on_menu_event(app_menu::handle_event)
        .plugin(logging::plugin(profile_root.as_deref()))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed
                        && let Err(error) = show_quick_capture_window(app)
                    {
                        log::error!("global shortcut could not show Quick Capture: {error}");
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let paths = RuntimePaths::resolve(app.handle(), setup_profile_root.as_deref())?;
            let store = AppStateStore::load(paths.app_data_directory())?;
            let locale = store.language_preference().effective();
            app.set_menu(app_menu::build_for_locale(app.handle(), locale)?)?;
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            restore_main_window(&window, store.main_window_geometry())?;
            let quick_capture = app
                .get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            restore_quick_capture_window(&quick_capture, store.quick_capture_position())?;
            let shortcut = ShortcutManager::start(app.handle(), store.shortcut());
            app.manage(paths.clone());
            app.manage(DesktopState::new(store, shortcut));
            if let Some(state) = app.try_state::<DesktopState>()
                && let Ok(mut store) = state.app_state.lock()
                && let Err(error) = auto_maintain_cli(app.handle(), &mut store, &paths)
            {
                log::warn!("automatic CLI maintenance failed during startup: {error}");
            }
            if !is_hidden_startup(std::env::args_os()) {
                window.show()?;
                log::info!("Main Window shown at startup");
            } else {
                log::info!("Sidequest started hidden");
            }
            log::info!(
                "Sidequest started version={} profile={}",
                env!("CARGO_PKG_VERSION"),
                if paths.is_isolated() {
                    "isolated"
                } else {
                    "default"
                }
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_state,
            commands::get_locale_settings,
            commands::set_locale_preference,
            commands::add_project,
            commands::remove_project,
            commands::set_last_selected_project,
            commands::relocate_project,
            commands::set_panel_preferences,
            commands::save_main_window_geometry,
            commands::hide_main_window,
            commands::show_quick_capture,
            commands::hide_quick_capture,
            commands::save_quick_capture_position,
            commands::complete_app_quit,
            commands::load_workspace,
            commands::create_quest,
            commands::capture_quest,
            commands::update_quest_content,
            commands::set_quest_status,
            commands::delete_quest,
            commands::search_quests,
            commands::set_watched_project,
            commands::get_settings,
            commands::set_global_shortcut,
            commands::set_launch_at_login,
            commands::set_onboarding_step,
            commands::get_integration_status,
            commands::install_cli,
            commands::uninstall_cli,
            commands::install_agent_skill,
            commands::uninstall_agent_skill,
            diagnostics::get_diagnostic_report,
            diagnostics::reveal_diagnostic_logs,
        ])
        .build(tauri::generate_context!())?;

    let exit_code = app.run_return(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            let approved = app_handle
                .try_state::<DesktopState>()
                .is_some_and(|state| state.consume_quit_approval());
            if !approved {
                api.prevent_exit();
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(error) = window.show() {
                        log::error!("could not show Main Window for quit approval: {error}");
                    }
                    if let Err(error) = window.unminimize() {
                        log::warn!("could not unminimize Main Window for quit approval: {error}");
                    }
                    if let Err(error) = window.set_focus() {
                        log::warn!("could not focus Main Window for quit approval: {error}");
                    }
                }
                if let Err(error) = app_handle.emit("app-quit-requested", ()) {
                    log::error!("could not emit app-quit-requested: {error}");
                }
                log::info!("application quit requested; waiting for write guard");
            } else {
                log::info!("application quit approved");
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows && let Some(window) = app_handle.get_webview_window("main") {
                if let Err(error) = window.show() {
                    log::error!("could not show Main Window on Dock reopen: {error}");
                }
                if let Err(error) = window.unminimize() {
                    log::warn!("could not unminimize Main Window on Dock reopen: {error}");
                }
                if let Err(error) = window.set_focus() {
                    log::warn!("could not focus Main Window on Dock reopen: {error}");
                }
                log::info!("Main Window restored from Dock reopen");
            }
        }
        _ => {}
    });
    log::info!("Sidequest event loop exited code={exit_code}");
    if exit_code == 0 {
        Ok(())
    } else {
        std::process::exit(exit_code)
    }
}

fn is_hidden_startup(arguments: impl IntoIterator<Item = std::ffi::OsString>) -> bool {
    arguments.into_iter().any(|argument| argument == "--hidden")
}

#[cfg(test)]
mod tests {
    use super::is_hidden_startup;

    #[test]
    fn hidden_argument_should_suppress_main_window() {
        assert!(is_hidden_startup(["sidequest".into(), "--hidden".into()]));
    }

    #[test]
    fn ordinary_start_should_show_main_window() {
        assert!(!is_hidden_startup(["sidequest".into()]));
    }
}
