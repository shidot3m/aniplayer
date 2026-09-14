pub mod db;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use db::models::*;
use db::Database;

pub struct AppState {
    pub db: Arc<Database>,
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

// Database IPC commands
#[tauri::command]
fn db_save_bookmark(state: State<'_, AppState>, item: BookmarkItem) -> Result<(), String> {
    state.db.save_bookmark(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_bookmarks(state: State<'_, AppState>, category: Option<String>) -> Result<Vec<BookmarkItem>, String> {
    state.db.get_bookmarks(category).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_bookmark(state: State<'_, AppState>, release_id: i64) -> Result<(), String> {
    state.db.delete_bookmark(release_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_history(state: State<'_, AppState>, item: HistoryItem) -> Result<(), String> {
    state.db.save_history(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_continue_watching(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    state.db.get_continue_watching().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.db.save_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_download_meta(state: State<'_, AppState>, item: DownloadedEpisodeMeta) -> Result<(), String> {
    state.db.save_downloaded_episode(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_download_meta(state: State<'_, AppState>, episode_id: String) -> Result<Option<DownloadedEpisodeMeta>, String> {
    state.db.get_downloaded_episode(&episode_id).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    
    let db_dir = app_dir.join("data");
    let _ = std::fs::create_dir_all(&db_dir);
    let db_path = db_dir.join("aniplayer.db");
    let database = Arc::new(Database::new(&db_path).unwrap_or_else(|_| {
        Database::init_in_memory().expect("Fatal: SQLite initialization failed")
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { db: database })
        .invoke_handler(tauri::generate_handler![
            ping,
            db_save_bookmark,
            db_get_bookmarks,
            db_delete_bookmark,
            db_save_history,
            db_get_continue_watching,
            db_save_setting,
            db_get_setting,
            db_save_download_meta,
            db_get_download_meta,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
