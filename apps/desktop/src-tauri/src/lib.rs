//! Native application entry point for Sidequest Desktop.

mod app_state;
mod commands;
mod dto;
mod error;
mod watcher;
mod window_state;

use tauri::Manager;

use crate::app_state::{AppStateStore, DesktopState};
use crate::window_state::restore_main_window;

/// Runs the Sidequest desktop application.
///
/// # Errors
///
/// Returns a Tauri error when application setup or the native event loop fails.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
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
            commands::load_workspace,
            commands::create_quest,
            commands::update_quest_content,
            commands::set_quest_status,
            commands::delete_quest,
            commands::search_quests,
            commands::set_watched_project,
        ])
        .run(tauri::generate_context!())
}
