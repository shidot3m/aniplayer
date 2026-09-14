pub mod api;
pub mod db;
pub mod downloader;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use api::models::*;
use api::AnilibriaClient;
use db::models::*;
use db::Database;
use downloader::HlsDownloader;

pub struct AppState {
    pub db: Arc<Database>,
    pub api: Arc<AnilibriaClient>,
    pub downloader: Arc<HlsDownloader>,
    pub app_dir: PathBuf,
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

// API IPC commands
#[tauri::command]
async fn api_get_status(state: State<'_, AppState>) -> Result<ApiStatus, String> {
    state.api.get_status().await
}

#[tauri::command]
async fn api_get_latest_releases(state: State<'_, AppState>, limit: Option<u32>) -> Result<Vec<ReleasePreview>, String> {
    state.api.get_latest_releases(limit.unwrap_or(20)).await
}

#[tauri::command]
async fn api_get_schedule_week(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.api.get_schedule_week().await
}

#[tauri::command]
async fn api_get_genres(state: State<'_, AppState>) -> Result<Vec<GenreItem>, String> {
    state.api.get_genres().await
}

#[tauri::command]
async fn api_get_genre_releases(state: State<'_, AppState>, genre_id: i64) -> Result<Vec<ReleasePreview>, String> {
    state.api.get_genre_releases(genre_id).await
}

#[tauri::command]
async fn api_get_release(state: State<'_, AppState>, id_or_alias: String) -> Result<ReleaseDetails, String> {
    state.api.get_release(&id_or_alias).await
}

#[tauri::command]
async fn api_get_release_torrents(state: State<'_, AppState>, release_id: i64) -> Result<Vec<TorrentItem>, String> {
    state.api.get_release_torrents(release_id).await
}

#[tauri::command]
async fn api_search_releases(state: State<'_, AppState>, query: String) -> Result<Vec<ReleasePreview>, String> {
    state.api.search_releases(&query).await
}

// Downloader IPC command
#[tauri::command]
async fn downloader_start_episode(
    state: State<'_, AppState>,
    episode_id: String,
    release_id: i64,
    ordinal: f64,
    m3u8_url: String,
    quality: String,
    op_start: Option<f64>,
    op_stop: Option<f64>,
    ed_start: Option<f64>,
    ed_stop: Option<f64>,
) -> Result<String, String> {
    let path = state.downloader.download_episode(
        &state.app_dir,
        &episode_id,
        release_id,
        ordinal,
        &m3u8_url,
        &quality,
        op_start,
        op_stop,
        ed_start,
        ed_stop,
    ).await?;
    Ok(path.to_string_lossy().to_string())
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
    let api_client = Arc::new(AnilibriaClient::new());
    let downloader = Arc::new(HlsDownloader::new(database.clone()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: database,
            api: api_client,
            downloader,
            app_dir,
        })
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
            api_get_status,
            api_get_latest_releases,
            api_get_schedule_week,
            api_get_genres,
            api_get_genre_releases,
            api_get_release,
            api_get_release_torrents,
            api_search_releases,
            downloader_start_episode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
