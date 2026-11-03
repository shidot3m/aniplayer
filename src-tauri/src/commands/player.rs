//! Player IPC. Every command here runs off the main thread: `MpvSupervisor` serializes
//! sessions behind one mutex, and `open()` holds that mutex while it asks the main thread
//! for window geometry and visibility. A command that waited on the mutex from the main
//! thread would close the cycle and freeze all IPC (verified in #30).

use tauri::{Manager, State};

use crate::player::MpvOpenRequest;
use crate::state::AppState;

#[tauri::command]
pub(crate) async fn player_open(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: MpvOpenRequest,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    let player = state.player.clone();
    tauri::async_runtime::spawn_blocking(move || player.open(&app, &main, request))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command(async)]
pub(crate) fn player_close(app: tauri::AppHandle, state: State<'_, AppState>) {
    state.player.close(app.get_webview_window("main").as_ref());
}

#[tauri::command(async)]
pub(crate) fn player_set_pause(state: State<'_, AppState>, paused: bool) -> Result<(), String> {
    state.player.set_pause(paused)
}

#[tauri::command(async)]
pub(crate) fn player_seek(state: State<'_, AppState>, seconds: f64) -> Result<(), String> {
    state.player.seek(seconds)
}

#[tauri::command(async)]
pub(crate) fn player_set_volume(
    state: State<'_, AppState>,
    volume: f64,
    muted: bool,
) -> Result<(), String> {
    state.player.set_volume(volume, muted)
}

#[tauri::command(async)]
pub(crate) fn player_set_speed(state: State<'_, AppState>, speed: f64) -> Result<(), String> {
    state.player.set_speed(speed)
}

#[tauri::command(async)]
pub(crate) fn player_set_anime4k(
    state: State<'_, AppState>,
    enabled: bool,
    preset: String,
) -> Result<(), String> {
    state.player.set_anime4k(enabled, &preset)
}
