//! Native application entry point for Sidequest Desktop.

mod app_menu;
mod app_state;
mod commands;
mod dto;
mod error;
mod integration;
mod native_events;
mod quick_capture_window;
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
use crate::shortcut::ShortcutManager;
use crate::window_state::restore_main_window;

/// Runs the Sidequest desktop application.
///
/// # Errors
///
/// Returns a Tauri error when application setup or the native event loop fails.
pub fn run() -> tauri::Result<()> {
    let app = tauri::Builder::default()
        .menu(app_menu::build)
        .on_menu_event(app_menu::handle_event)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _show_result = show_quick_capture_window(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_directory = app.path().app_data_dir()?;
            let store = AppStateStore::load(&app_data_directory)?;
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            restore_main_window(&window, store.main_window_geometry())?;
            let quick_capture = app
                .get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            restore_quick_capture_window(&quick_capture, store.quick_capture_position())?;
            let shortcut = ShortcutManager::start(app.handle(), store.shortcut());
            app.manage(DesktopState::new(store, shortcut));
            if let Some(state) = app.try_state::<DesktopState>()
                && let Ok(mut store) = state.app_state.lock()
            {
                let _maintenance_result = auto_maintain_cli(app.handle(), &mut store);
            }
            if !is_hidden_startup(std::env::args_os()) {
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_state,
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
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = app_handle.emit("app-quit-requested", ());
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows && let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        _ => {}
    });
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
