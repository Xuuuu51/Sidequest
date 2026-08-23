use tauri::{AppHandle, Manager, menu::*};

use crate::quick_capture_window::show_quick_capture_window;

pub(crate) const OPEN_SIDEQUEST_MENU_ID: &str = "open_sidequest";
pub(crate) const QUICK_CAPTURE_MENU_ID: &str = "quick_capture";
pub(crate) const SETTINGS_MENU_ID: &str = "settings_disabled";
pub(crate) const QUIT_SIDEQUEST_MENU_ID: &str = "quit_sidequest";

pub(crate) fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    #[cfg(target_os = "macos")]
    {
        let about = PredefinedMenuItem::about(app, None, None)?;
        let open = MenuItem::with_id(
            app,
            OPEN_SIDEQUEST_MENU_ID,
            "Open Sidequest",
            true,
            None::<&str>,
        )?;
        let quick_capture = MenuItem::with_id(
            app,
            QUICK_CAPTURE_MENU_ID,
            "Quick Capture",
            true,
            None::<&str>,
        )?;
        let settings = MenuItem::with_id(
            app,
            SETTINGS_MENU_ID,
            "Settings…",
            false,
            Some("CmdOrCtrl+,"),
        )?;
        let app_menu = Submenu::with_items(
            app,
            "Sidequest",
            true,
            &[
                &about,
                &PredefinedMenuItem::separator(app)?,
                &open,
                &quick_capture,
                &settings,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(
                    app,
                    QUIT_SIDEQUEST_MENU_ID,
                    "Quit Sidequest",
                    true,
                    Some("CmdOrCtrl+Q"),
                )?,
            ],
        )?;
        let file = Submenu::with_items(
            app,
            "File",
            true,
            &[&PredefinedMenuItem::close_window(app, None)?],
        )?;
        let edit = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &PredefinedMenuItem::undo(app, None)?,
                &PredefinedMenuItem::redo(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, None)?,
                &PredefinedMenuItem::copy(app, None)?,
                &PredefinedMenuItem::paste(app, None)?,
                &PredefinedMenuItem::select_all(app, None)?,
            ],
        )?;
        let view = Submenu::with_items(
            app,
            "View",
            true,
            &[&PredefinedMenuItem::fullscreen(app, None)?],
        )?;
        let window = Submenu::with_items(
            app,
            "Window",
            true,
            &[
                &PredefinedMenuItem::minimize(app, None)?,
                &PredefinedMenuItem::maximize(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::close_window(app, None)?,
            ],
        )?;
        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }

    #[cfg(not(target_os = "macos"))]
    Menu::default(app)
}

pub(crate) fn handle_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        OPEN_SIDEQUEST_MENU_ID => {
            if let Some(window) = app.get_webview_window("main") {
                let _show_result = window.show();
                let _unminimize_result = window.unminimize();
                let _focus_result = window.set_focus();
            }
        }
        QUICK_CAPTURE_MENU_ID => {
            let _show_result = show_quick_capture_window(app);
        }
        QUIT_SIDEQUEST_MENU_ID => app.exit(0),
        _ => {}
    }
}
