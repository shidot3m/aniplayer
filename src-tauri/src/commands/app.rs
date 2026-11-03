use tauri::Manager;

#[tauri::command]
pub(crate) fn ping() -> String {
    "pong".to_string()
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
