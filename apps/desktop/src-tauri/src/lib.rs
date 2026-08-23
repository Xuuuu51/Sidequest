//! Native application entry point for Sidequest Desktop.

/// Runs the Sidequest desktop application.
///
/// # Errors
///
/// Returns a Tauri error when application setup or the native event loop fails.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default().run(tauri::generate_context!())
}
