//! Sidequest command-line application entry point.

mod app;
mod dto;
mod output;

fn main() -> std::process::ExitCode {
    app::run()
}
