use tauri::{AppHandle, Emitter, Manager, menu::*};

use crate::locale::{EffectiveLocale, LanguagePreference, native_translations};
use crate::quick_capture_window::show_quick_capture_window;

pub(crate) const OPEN_SIDEQUEST_MENU_ID: &str = "open_sidequest";
pub(crate) const QUICK_CAPTURE_MENU_ID: &str = "quick_capture";
pub(crate) const SETTINGS_MENU_ID: &str = "settings";
pub(crate) const QUIT_SIDEQUEST_MENU_ID: &str = "quit_sidequest";
#[cfg(debug_assertions)]
const OPEN_DEVTOOLS_MENU_ID: &str = "debug_open_devtools";
#[cfg(debug_assertions)]
const RELOAD_WINDOW_MENU_ID: &str = "debug_reload_window";
#[cfg(debug_assertions)]
const OPEN_LOGS_MENU_ID: &str = "debug_open_logs";
#[cfg(debug_assertions)]
pub(crate) const DEBUG_RELOAD_REQUESTED_EVENT: &str = "debug-reload-requested";

pub(crate) fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    build_for_locale(app, LanguagePreference::System.effective())
}

pub(crate) fn build_for_locale(
    app: &AppHandle,
    locale: EffectiveLocale,
) -> tauri::Result<Menu<tauri::Wry>> {
    #[cfg(target_os = "macos")]
    {
        let translations = native_translations(locale);
        let about = PredefinedMenuItem::about(app, Some(translations.app.about.as_str()), None)?;
        let open = MenuItem::with_id(
            app,
            OPEN_SIDEQUEST_MENU_ID,
            &translations.app.open,
            true,
            None::<&str>,
        )?;
        let quick_capture = MenuItem::with_id(
            app,
            QUICK_CAPTURE_MENU_ID,
            &translations.app.quick_capture,
            true,
            None::<&str>,
        )?;
        let settings = MenuItem::with_id(
            app,
            SETTINGS_MENU_ID,
            &translations.app.settings,
            true,
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
                &PredefinedMenuItem::services(app, Some(&translations.app.services))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, Some(&translations.app.hide))?,
                &PredefinedMenuItem::hide_others(app, Some(&translations.app.hide_others))?,
                &PredefinedMenuItem::show_all(app, Some(&translations.app.show_all))?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(
                    app,
                    QUIT_SIDEQUEST_MENU_ID,
                    &translations.app.quit,
                    true,
                    Some("CmdOrCtrl+Q"),
                )?,
            ],
        )?;
        let file = Submenu::with_items(
            app,
            &translations.menu.file,
            true,
            &[&PredefinedMenuItem::close_window(
                app,
                Some(&translations.menu.close_window),
            )?],
        )?;
        let edit = Submenu::with_items(
            app,
            &translations.menu.edit,
            true,
            &[
                &PredefinedMenuItem::undo(app, Some(&translations.menu.undo))?,
                &PredefinedMenuItem::redo(app, Some(&translations.menu.redo))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, Some(&translations.menu.cut))?,
                &PredefinedMenuItem::copy(app, Some(&translations.menu.copy))?,
                &PredefinedMenuItem::paste(app, Some(&translations.menu.paste))?,
                &PredefinedMenuItem::select_all(app, Some(&translations.menu.select_all))?,
            ],
        )?;
        let view = Submenu::with_items(
            app,
            &translations.menu.view,
            true,
            &[&PredefinedMenuItem::fullscreen(
                app,
                Some(&translations.menu.enter_full_screen),
            )?],
        )?;
        let window = Submenu::with_items(
            app,
            &translations.menu.window,
            true,
            &[
                &PredefinedMenuItem::minimize(app, Some(&translations.menu.minimize))?,
                &PredefinedMenuItem::maximize(app, Some(&translations.menu.zoom))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::close_window(app, Some(&translations.menu.close_window))?,
            ],
        )?;
        #[cfg(debug_assertions)]
        {
            let debug = Submenu::with_items(
                app,
                &translations.menu.debug,
                true,
                &[
                    &MenuItem::with_id(
                        app,
                        OPEN_DEVTOOLS_MENU_ID,
                        &translations.menu.open_dev_tools,
                        true,
                        Some("CmdOrCtrl+Alt+I"),
                    )?,
                    &MenuItem::with_id(
                        app,
                        RELOAD_WINDOW_MENU_ID,
                        &translations.menu.reload_active_window,
                        true,
                        None::<&str>,
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        OPEN_LOGS_MENU_ID,
                        &translations.menu.open_logs,
                        true,
                        None::<&str>,
                    )?,
                ],
            )?;
            Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window, &debug])
        }

        #[cfg(not(debug_assertions))]
        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = locale;
        Menu::default(app)
    }
}

pub(crate) fn handle_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        OPEN_SIDEQUEST_MENU_ID => {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = show_and_focus(&window) {
                    log::error!("Open Sidequest menu failed: {error}");
                } else {
                    log::info!("Main Window opened from menu");
                }
            } else {
                log::error!("Open Sidequest menu could not find Main Window");
            }
        }
        QUICK_CAPTURE_MENU_ID => {
            if let Err(error) = show_quick_capture_window(app) {
                log::error!("Quick Capture menu failed: {error}");
            }
        }
        SETTINGS_MENU_ID => {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = show_and_focus(&window) {
                    log::error!("Settings menu could not show Main Window: {error}");
                } else if let Err(error) =
                    window.emit(crate::native_events::OPEN_SETTINGS_EVENT, ())
                {
                    log::error!("Settings menu could not notify Main Window: {error}");
                }
            } else {
                log::error!("Settings menu could not find Main Window");
            }
        }
        QUIT_SIDEQUEST_MENU_ID => app.exit(0),
        #[cfg(debug_assertions)]
        OPEN_DEVTOOLS_MENU_ID => {
            if let Some(window) = active_window(app) {
                window.open_devtools();
                log::debug!("DevTools opened for window={}", window.label());
            } else {
                log::warn!("Open DevTools could not find an active window");
            }
        }
        #[cfg(debug_assertions)]
        RELOAD_WINDOW_MENU_ID => {
            if let Some(window) = active_window(app) {
                if let Err(error) = window.emit(DEBUG_RELOAD_REQUESTED_EVENT, ()) {
                    log::error!("could not request debug reload: {error}");
                }
            } else {
                log::warn!("Reload Active Window could not find an active window");
            }
        }
        #[cfg(debug_assertions)]
        OPEN_LOGS_MENU_ID => {
            if let Err(error) = crate::diagnostics::reveal_logs(app) {
                log::error!("Open Logs menu failed: {error}");
            }
        }
        _ => {}
    }
}

fn show_and_focus(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    window.show()?;
    window.unminimize()?;
    window.set_focus()
}

#[cfg(debug_assertions)]
fn active_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"))
}
