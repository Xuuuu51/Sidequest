use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow, window::Monitor};

use crate::app_state::{
    DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH,
    MainWindowGeometry,
};

const MIN_VISIBLE_TITLEBAR_WIDTH: i32 = 120;
const TITLEBAR_HEIGHT: i32 = 44;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct DisplayArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub(crate) fn restore_main_window(
    window: &WebviewWindow,
    stored: Option<MainWindowGeometry>,
) -> tauri::Result<()> {
    let monitors = window.available_monitors()?;
    let displays: Vec<DisplayArea> = monitors.iter().map(display_area).collect();
    let primary = window.primary_monitor()?.as_ref().map(display_area);
    let geometry = resolve_geometry(stored, &displays, primary);

    window.set_size(PhysicalSize::new(geometry.width, geometry.height))?;
    window.set_position(PhysicalPosition::new(geometry.x, geometry.y))?;
    if geometry.maximized {
        window.maximize()?;
    }
    Ok(())
}

pub(crate) fn capture_main_window(window: &WebviewWindow) -> tauri::Result<MainWindowGeometry> {
    let position = window.outer_position()?;
    let size = window.inner_size()?;
    Ok(MainWindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width.max(MIN_WINDOW_WIDTH),
        height: size.height.max(MIN_WINDOW_HEIGHT),
        maximized: window.is_maximized()?,
    })
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

fn resolve_geometry(
    stored: Option<MainWindowGeometry>,
    displays: &[DisplayArea],
    primary: Option<DisplayArea>,
) -> MainWindowGeometry {
    if let Some(geometry) = stored
        && let Some(display) = displays
            .iter()
            .copied()
            .find(|display| titlebar_is_visible(geometry, *display))
    {
        return fit_to_display(geometry, display);
    }

    let fallback = primary.or_else(|| displays.first().copied());
    fallback.map_or(
        MainWindowGeometry {
            x: 0,
            y: 0,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            maximized: false,
        },
        center_default,
    )
}

fn titlebar_is_visible(geometry: MainWindowGeometry, display: DisplayArea) -> bool {
    let left = i64::from(geometry.x).max(i64::from(display.x));
    let right = (i64::from(geometry.x) + i64::from(geometry.width))
        .min(i64::from(display.x) + i64::from(display.width));
    let top = i64::from(geometry.y).max(i64::from(display.y));
    let bottom = (i64::from(geometry.y) + i64::from(TITLEBAR_HEIGHT))
        .min(i64::from(display.y) + i64::from(display.height));
    right - left >= i64::from(MIN_VISIBLE_TITLEBAR_WIDTH) && bottom > top
}

fn fit_to_display(mut geometry: MainWindowGeometry, display: DisplayArea) -> MainWindowGeometry {
    geometry.width = geometry
        .width
        .max(MIN_WINDOW_WIDTH)
        .min(display.width.max(MIN_WINDOW_WIDTH));
    geometry.height = geometry
        .height
        .max(MIN_WINDOW_HEIGHT)
        .min(display.height.max(MIN_WINDOW_HEIGHT));
    geometry.x = clamp_axis(geometry.x, geometry.width, display.x, display.width);
    geometry.y = clamp_axis(geometry.y, geometry.height, display.y, display.height);
    geometry
}

fn center_default(display: DisplayArea) -> MainWindowGeometry {
    let width = DEFAULT_WINDOW_WIDTH.min(display.width.max(MIN_WINDOW_WIDTH));
    let height = DEFAULT_WINDOW_HEIGHT.min(display.height.max(MIN_WINDOW_HEIGHT));
    MainWindowGeometry {
        x: display.x + half_difference(display.width, width),
        y: display.y + half_difference(display.height, height),
        width,
        height,
        maximized: false,
    }
}

fn half_difference(outer: u32, inner: u32) -> i32 {
    i32::try_from(outer.saturating_sub(inner) / 2).unwrap_or(i32::MAX)
}

fn clamp_axis(position: i32, size: u32, display_position: i32, display_size: u32) -> i32 {
    let maximum =
        i64::from(display_position) + i64::from(display_size) - i64::from(size.min(display_size));
    i64::from(position)
        .clamp(i64::from(display_position), maximum)
        .try_into()
        .unwrap_or(display_position)
}

#[cfg(test)]
mod tests {
    use super::{DisplayArea, center_default, resolve_geometry};
    use crate::app_state::MainWindowGeometry;

    const DISPLAY: DisplayArea = DisplayArea {
        x: 0,
        y: 0,
        width: 1512,
        height: 982,
    };

    #[test]
    fn valid_geometry_should_be_restored() {
        let stored = MainWindowGeometry {
            x: 120,
            y: 80,
            width: 1280,
            height: 800,
            maximized: true,
        };

        assert_eq!(
            resolve_geometry(Some(stored), &[DISPLAY], Some(DISPLAY)),
            stored
        );
    }

    #[test]
    fn missing_display_should_fall_back_to_centered_primary_display() {
        let stored = MainWindowGeometry {
            x: 4000,
            y: 4000,
            width: 1280,
            height: 800,
            maximized: true,
        };

        assert_eq!(
            resolve_geometry(Some(stored), &[DISPLAY], Some(DISPLAY)),
            center_default(DISPLAY)
        );
    }

    #[test]
    fn partially_visible_window_should_be_kept_inside_its_display() {
        let stored = MainWindowGeometry {
            x: -40,
            y: -10,
            width: 1280,
            height: 800,
            maximized: false,
        };

        let restored = resolve_geometry(Some(stored), &[DISPLAY], Some(DISPLAY));

        assert_eq!(restored.x, 0);
        assert_eq!(restored.y, 0);
    }
}
