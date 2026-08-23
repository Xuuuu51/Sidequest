// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Sidequest desktop application entry point.

fn main() {
    if let Err(error) = sidequest_desktop_lib::run() {
        eprintln!("failed to run Sidequest: {error}");
        std::process::exit(1);
    }
}
