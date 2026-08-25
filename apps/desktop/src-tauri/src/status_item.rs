use std::sync::Mutex;

use tauri::{
    AppHandle, Emitter, Manager, WebviewWindow, image::Image, menu::*, tray::TrayIconBuilder,
};

use crate::app_menu::{
    QUICK_CAPTURE_MENU_ID, QUIT_SIDEQUEST_MENU_ID, SETTINGS_MENU_ID, show_and_focus,
};
use crate::locale::{EffectiveLocale, native_translations};
use crate::native_events::HIDE_MAIN_WINDOW_REQUESTED_EVENT;
use crate::shortcut::ShortcutSpec;

const STATUS_ITEM_ID: &str = "sidequest_status_item";
const TOGGLE_MAIN_WINDOW_MENU_ID: &str = "toggle_main_window";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum MainWindowAction {
    Show,
    Hide,
}

#[derive(Clone, Debug)]
struct Presentation {
    locale: EffectiveLocale,
    shortcut: ShortcutSpec,
    main_window_action: MainWindowAction,
}

pub(crate) struct StatusItemState {
    presentation: Mutex<Presentation>,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum StatusItemError {
    #[error("status item state lock is poisoned")]
    StatePoisoned,
    #[error("status item is unavailable")]
    Unavailable,
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

type Result<T> = std::result::Result<T, StatusItemError>;

pub(crate) fn install(
    app: &mut tauri::App,
    locale: EffectiveLocale,
    shortcut: ShortcutSpec,
) -> Result<()> {
    let presentation = Presentation {
        locale,
        shortcut,
        main_window_action: MainWindowAction::Show,
    };
    let menu = build_menu(app.handle(), &presentation)?;
    let icon = Image::from_bytes(include_bytes!(
        "../icons/menu-bar/SidequestInverseTemplate.png"
    ))?;
    TrayIconBuilder::with_id(STATUS_ITEM_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Sidequest")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .build(app)?;
    app.manage(StatusItemState {
        presentation: Mutex::new(presentation),
    });
    Ok(())
}

pub(crate) fn handle_menu_event(app: &AppHandle, event: &tauri::menu::MenuEvent) -> bool {
    if event.id().as_ref() != TOGGLE_MAIN_WINDOW_MENU_ID {
        return false;
    }
    let Some(window) = app.get_webview_window("main") else {
        log::error!("status item could not find Main Window");
        return true;
    };
    match current_action(app) {
        Ok(MainWindowAction::Show) => {
            if let Err(error) = show_main_window(app, &window) {
                log::error!("status item could not show Main Window: {error}");
            }
        }
        Ok(MainWindowAction::Hide) => {
            if let Err(error) = window.emit(HIDE_MAIN_WINDOW_REQUESTED_EVENT, ()) {
                log::error!("status item could not request Main Window hide: {error}");
            }
        }
        Err(error) => log::error!("status item action is unavailable: {error}"),
    }
    true
}

pub(crate) fn show_main_window(app: &AppHandle, window: &WebviewWindow) -> Result<()> {
    show_and_focus(window)?;
    update_main_window_state(app, true, true)?;
    Ok(())
}

pub(crate) fn update_locale(app: &AppHandle, locale: EffectiveLocale) -> Result<()> {
    update_presentation(app, |presentation| presentation.locale = locale)
}

pub(crate) fn update_shortcut(app: &AppHandle, shortcut: ShortcutSpec) -> Result<()> {
    update_presentation(app, |presentation| presentation.shortcut = shortcut)
}

pub(crate) fn update_main_window_state(
    app: &AppHandle,
    visible: bool,
    focused: bool,
) -> Result<()> {
    let action = main_window_action(visible, focused);
    update_presentation(app, |presentation| {
        presentation.main_window_action = action;
    })
}

fn current_action(app: &AppHandle) -> Result<MainWindowAction> {
    let state = app.state::<StatusItemState>();
    let presentation = state
        .presentation
        .lock()
        .map_err(|_| StatusItemError::StatePoisoned)?;
    Ok(presentation.main_window_action)
}

fn update_presentation(app: &AppHandle, update: impl FnOnce(&mut Presentation)) -> Result<()> {
    let state = app.state::<StatusItemState>();
    let mut next = state
        .presentation
        .lock()
        .map_err(|_| StatusItemError::StatePoisoned)?
        .clone();
    update(&mut next);
    let menu = build_menu(app, &next)?;
    let tray = app
        .tray_by_id(STATUS_ITEM_ID)
        .ok_or(StatusItemError::Unavailable)?;
    tray.set_menu(Some(menu))?;
    let mut current = state
        .presentation
        .lock()
        .map_err(|_| StatusItemError::StatePoisoned)?;
    *current = next;
    Ok(())
}

fn build_menu(app: &AppHandle, presentation: &Presentation) -> Result<Menu<tauri::Wry>> {
    let translations = native_translations(presentation.locale);
    let toggle = MenuItem::with_id(
        app,
        TOGGLE_MAIN_WINDOW_MENU_ID,
        main_window_label(
            presentation.main_window_action,
            &translations.status_item.show_main_window,
            &translations.status_item.hide_main_window,
        ),
        true,
        None::<&str>,
    )?;
    let quick_capture = MenuItem::with_id(
        app,
        QUICK_CAPTURE_MENU_ID,
        &translations.app.quick_capture,
        true,
        Some(presentation.shortcut.accelerator()),
    )?;
    let settings = MenuItem::with_id(
        app,
        SETTINGS_MENU_ID,
        &translations.app.settings,
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let quit = MenuItem::with_id(
        app,
        QUIT_SIDEQUEST_MENU_ID,
        &translations.app.quit,
        true,
        Some("CmdOrCtrl+Q"),
    )?;
    Ok(Menu::with_items(
        app,
        &[
            &toggle,
            &quick_capture,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?)
}

fn main_window_action(visible: bool, focused: bool) -> MainWindowAction {
    if visible && focused {
        MainWindowAction::Hide
    } else {
        MainWindowAction::Show
    }
}

fn main_window_label<'a>(
    action: MainWindowAction,
    show_label: &'a str,
    hide_label: &'a str,
) -> &'a str {
    match action {
        MainWindowAction::Show => show_label,
        MainWindowAction::Hide => hide_label,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_window_should_offer_hide_only_when_visible_and_focused() {
        assert_eq!(main_window_action(true, true), MainWindowAction::Hide);
    }

    #[test]
    fn obscured_main_window_should_offer_show() {
        assert_eq!(main_window_action(true, false), MainWindowAction::Show);
    }

    #[test]
    fn hidden_main_window_should_offer_show() {
        assert_eq!(main_window_action(false, false), MainWindowAction::Show);
    }

    #[test]
    fn shortcut_hint_should_use_the_current_native_accelerator() {
        assert_eq!(ShortcutSpec::default().accelerator(), "Command+Shift+Space");
    }

    #[test]
    fn localized_main_window_labels_should_match_the_selected_action() {
        let translations = native_translations(EffectiveLocale::SimplifiedChinese);
        assert_eq!(
            main_window_label(
                MainWindowAction::Hide,
                &translations.status_item.show_main_window,
                &translations.status_item.hide_main_window,
            ),
            "隐藏主窗口"
        );
    }
}
