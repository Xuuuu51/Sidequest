//! Native application entry point for Sidequest Desktop.

mod app_state;
mod commands;
mod dto;
mod error;
mod watcher;
mod window_state;

use tauri::{Emitter, Manager};

use crate::app_state::{AppStateStore, DesktopState};
use crate::window_state::restore_main_window;

/// Runs the Sidequest desktop application.
///
/// # Errors
///
/// Returns a Tauri error when application setup or the native event loop fails.
pub fn run() -> tauri::Result<()> {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_directory = app.path().app_data_dir()?;
            let store = AppStateStore::load(&app_data_directory)?;
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            restore_main_window(&window, store.main_window_geometry())?;
            app.manage(DesktopState::new(store));
            window.show()?;
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
            commands::complete_app_quit,
            commands::load_workspace,
            commands::create_quest,
            commands::update_quest_content,
            commands::set_quest_status,
            commands::delete_quest,
            commands::search_quests,
            commands::set_watched_project,
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
