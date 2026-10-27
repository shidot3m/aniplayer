#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() -> Result<(), std::process::ExitCode> {
    if aniplayer_lib::run().is_err() {
        return Err(std::process::ExitCode::FAILURE);
    }
    Ok(())
}
