use tauri::{Emitter, Manager, State};

use crate::codec::CodecCapabilityReport;
use crate::downloader::scanner::rescan_downloaded_libraries;
use crate::state::AppState;

#[tauri::command]
pub(crate) fn ping() -> String {
    "pong".to_string()
}

/// Records what this WebView can decode, then rebuilds the downloaded library
/// against that answer: a decoder installed or removed since the last run changes
/// which files are worth offering, and an episode that cannot be decoded must not
/// stay registered as if it could. Returns how many entries are playable.
#[tauri::command]
pub(crate) async fn app_report_codec_capability(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    report: CodecCapabilityReport,
) -> Result<usize, String> {
    state.codec_caps.update(report);
    let torrents_root = crate::downloader::torrent::torrents_root(&state.app_dir);
    let db = state.db.clone();
    let codec_caps = state.codec_caps.clone();
    // The rescan opens every downloaded container, so it runs off the IPC thread
    // instead of freezing the window on a large library.
    let scanned = tauri::async_runtime::spawn_blocking(move || {
        rescan_downloaded_libraries(&torrents_root, &db, &codec_caps)
    })
    .await
    .map_err(|error| error.to_string())?;
    let playable = scanned?;
    let _ = app.emit("downloads-updated", ());
    Ok(playable)
}

#[tauri::command]
pub(crate) fn app_set_fullscreen(app: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub(crate) fn app_is_fullscreen(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_fullscreen().map_err(|e| e.to_string())
    } else {
        Err("Main window not found".to_string())
    }
}
