use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, window::Monitor};

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    CollectionBehavior, ManagerExt as _, PanelLevel, StyleMask, WebviewWindowExt as _,
};

use crate::app_state::QuickCapturePosition;
use crate::error::{DesktopError, Result};
use crate::native_events::{QUICK_CAPTURE_CLOSE_REQUESTED_EVENT, QUICK_CAPTURE_SHOWN_EVENT};
use tauri::Emitter;

pub(crate) const QUICK_CAPTURE_WINDOW_LABEL: &str = "quick-capture";
const EDGE_MARGIN: i32 = 24;
const MIN_VISIBLE_DRAG_WIDTH: i32 = 120;
const DRAG_REGION_HEIGHT: i32 = 44;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct DisplayArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(QuickCapturePanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true,
            hides_on_deactivate: false
        }
    })
}

#[cfg(target_os = "macos")]
pub(crate) fn configure_quick_capture_panel(window: &WebviewWindow) -> tauri::Result<()> {
    let panel = window.to_panel::<QuickCapturePanel>()?;
    panel.set_level(PanelLevel::Floating.value());
    panel.set_transparent(true);
    panel.set_corner_radius(14.0);
    panel.set_has_shadow(true);
    panel.set_accepts_mouse_moved_events(true);
    panel.set_style_mask(fullscreen_style_mask().value());
    panel.set_collection_behavior(fullscreen_collection_behavior().value());
    Ok(())
}

pub(crate) fn restore_quick_capture_window(
    window: &WebviewWindow,
    stored: Option<QuickCapturePosition>,
) -> tauri::Result<()> {
    let size = window.outer_size()?;
    let displays: Vec<DisplayArea> = window
        .available_monitors()?
        .iter()
        .map(display_area)
        .collect();
    let primary = window.primary_monitor()?.as_ref().map(display_area);
    let position = resolve_position(stored, size, &displays, primary);
    window.set_position(PhysicalPosition::new(position.x, position.y))
}

pub(crate) fn capture_quick_capture_position(
    window: &WebviewWindow,
) -> tauri::Result<QuickCapturePosition> {
    let position = window.outer_position()?;
    Ok(QuickCapturePosition {
        x: position.x,
        y: position.y,
    })
}

pub(crate) fn show_quick_capture_window(app: &AppHandle) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(QUICK_CAPTURE_WINDOW_LABEL)
            .map_err(|error| DesktopError::Window {
                operation: "find Quick Capture Panel",
                message: format!("{error:?}"),
            })?;
        panel.show_and_make_key();
    }

    #[cfg(not(target_os = "macos"))]
    {
        let window = app
            .get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
            .ok_or_else(|| DesktopError::Window {
                operation: "find Quick Capture Window",
                message: "Quick Capture Window is unavailable".to_owned(),
            })?;
        window.show().map_err(|error| window_error("show", error))?;
        window
            .unminimize()
            .map_err(|error| window_error("unminimize", error))?;
        window
            .set_focus()
            .map_err(|error| window_error("focus", error))?;
    }
    app.emit(QUICK_CAPTURE_SHOWN_EVENT, ())
        .map_err(|error| window_error("emit shown event for", error))?;
    log::info!("Quick Capture Window shown");
    Ok(())
}

pub(crate) fn toggle_quick_capture_window(app: &AppHandle) -> Result<()> {
    #[cfg(target_os = "macos")]
    let is_visible = app
        .get_webview_panel(QUICK_CAPTURE_WINDOW_LABEL)
        .map_err(|error| DesktopError::Window {
            operation: "find Quick Capture Panel",
            message: format!("{error:?}"),
        })?
        .is_visible();

    #[cfg(not(target_os = "macos"))]
    let is_visible = app
        .get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| DesktopError::Window {
            operation: "find Quick Capture Window",
            message: "Quick Capture Window is unavailable".to_owned(),
        })?
        .is_visible()
        .map_err(|error| window_error("inspect", error))?;

    if is_visible {
        app.emit(QUICK_CAPTURE_CLOSE_REQUESTED_EVENT, ())
            .map_err(|error| window_error("request close for", error))?;
        log::info!("Quick Capture close requested by global shortcut");
        Ok(())
    } else {
        show_quick_capture_window(app)
    }
}

pub(crate) fn focus_quick_capture_window(app: &AppHandle) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(QUICK_CAPTURE_WINDOW_LABEL)
            .map_err(|error| DesktopError::Window {
                operation: "find Quick Capture Panel",
                message: format!("{error:?}"),
            })?;
        panel.make_key_window();
    }

    #[cfg(not(target_os = "macos"))]
    app.get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| DesktopError::Window {
            operation: "find Quick Capture Window",
            message: "Quick Capture Window is unavailable".to_owned(),
        })?
        .set_focus()
        .map_err(|error| window_error("focus", error))?;

    Ok(())
}

pub(crate) fn hide_quick_capture_window(app: &AppHandle) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(QUICK_CAPTURE_WINDOW_LABEL)
            .map_err(|error| DesktopError::Window {
                operation: "find Quick Capture Panel",
                message: format!("{error:?}"),
            })?;
        panel.hide();
    }

    #[cfg(not(target_os = "macos"))]
    app.get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| DesktopError::Window {
            operation: "find Quick Capture Window",
            message: "Quick Capture Window is unavailable".to_owned(),
        })?
        .hide()
        .map_err(|error| window_error("hide", error))?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn fullscreen_collection_behavior() -> CollectionBehavior {
    CollectionBehavior::new()
        .can_join_all_spaces()
        .full_screen_auxiliary()
}

#[cfg(target_os = "macos")]
fn fullscreen_style_mask() -> StyleMask {
    StyleMask::empty().nonactivating_panel()
}

fn window_error(operation: &'static str, error: impl std::fmt::Display) -> DesktopError {
    DesktopError::Window {
        operation: match operation {
            "show" => "show Quick Capture Window",
            "unminimize" => "unminimize Quick Capture Window",
            "focus" => "focus Quick Capture Window",
            "hide" => "hide Quick Capture Window",
            _ => "notify Quick Capture Window",
        },
        message: error.to_string(),
    }
}

fn display_area(monitor: &Monitor) -> DisplayArea {
    let work_area = monitor.work_area();
    DisplayArea {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    }
}

fn resolve_position(
    stored: Option<QuickCapturePosition>,
    size: PhysicalSize<u32>,
    displays: &[DisplayArea],
    primary: Option<DisplayArea>,
) -> QuickCapturePosition {
    if let Some(position) = stored
        && displays
            .iter()
            .copied()
            .any(|display| drag_region_is_visible(position, size, display))
    {
        return position;
    }

    primary
        .or_else(|| displays.first().copied())
        .map_or(QuickCapturePosition { x: 0, y: 0 }, |display| {
            lower_left_position(display, size)
        })
}

fn drag_region_is_visible(
    position: QuickCapturePosition,
    size: PhysicalSize<u32>,
    display: DisplayArea,
) -> bool {
    let left = i64::from(position.x).max(i64::from(display.x));
    let right = (i64::from(position.x) + i64::from(size.width))
        .min(i64::from(display.x) + i64::from(display.width));
    let top = i64::from(position.y).max(i64::from(display.y));
    let bottom = (i64::from(position.y) + i64::from(DRAG_REGION_HEIGHT))
        .min(i64::from(display.y) + i64::from(display.height));
    right - left >= i64::from(MIN_VISIBLE_DRAG_WIDTH) && bottom > top
}

fn lower_left_position(display: DisplayArea, size: PhysicalSize<u32>) -> QuickCapturePosition {
    let height = i32::try_from(size.height).unwrap_or(i32::MAX);
    let display_height = i32::try_from(display.height).unwrap_or(i32::MAX);
    QuickCapturePosition {
        x: display.x.saturating_add(EDGE_MARGIN),
        y: display
            .y
            .saturating_add(display_height.saturating_sub(height))
            .saturating_sub(EDGE_MARGIN),
    }
}

#[cfg(test)]
mod tests {
    use tauri::PhysicalSize;

    use super::{DisplayArea, lower_left_position, resolve_position};
    use crate::app_state::QuickCapturePosition;

    const DISPLAY: DisplayArea = DisplayArea {
        x: 0,
        y: 0,
        width: 1512,
        height: 982,
    };
    const SIZE: PhysicalSize<u32> = PhysicalSize::new(520, 300);

    #[test]
    fn missing_position_should_use_primary_lower_left_corner() {
        assert_eq!(
            resolve_position(None, SIZE, &[DISPLAY], Some(DISPLAY)),
            QuickCapturePosition { x: 24, y: 658 }
        );
    }

    #[test]
    fn valid_position_should_be_restored() {
        let stored = QuickCapturePosition { x: 250, y: 140 };
        assert_eq!(
            resolve_position(Some(stored), SIZE, &[DISPLAY], Some(DISPLAY)),
            stored
        );
    }

    #[test]
    fn offscreen_position_should_fall_back_to_primary_display() {
        let stored = QuickCapturePosition { x: 4000, y: 4000 };
        assert_eq!(
            resolve_position(Some(stored), SIZE, &[DISPLAY], Some(DISPLAY)),
            lower_left_position(DISPLAY, SIZE)
        );
    }
}
