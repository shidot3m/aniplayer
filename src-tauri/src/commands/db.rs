use tauri::State;

use crate::db::models::{BookmarkItem, DownloadedEpisodeMeta, HistoryItem};
use crate::state::AppState;

#[tauri::command]
pub(crate) fn db_save_bookmark(
    state: State<'_, AppState>,
    item: BookmarkItem,
) -> Result<(), String> {
    state.db.save_bookmark(&item).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_bookmarks(
    state: State<'_, AppState>,
    category: Option<String>,
) -> Result<Vec<BookmarkItem>, String> {
    state.db.get_bookmarks(category).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_delete_bookmark(
    state: State<'_, AppState>,
    release_id: i64,
) -> Result<(), String> {
    state
        .db
        .delete_bookmark(release_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_save_history(state: State<'_, AppState>, item: HistoryItem) -> Result<(), String> {
    state.db.save_history(&item).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_continue_watching(
    state: State<'_, AppState>,
) -> Result<Vec<HistoryItem>, String> {
    state.db.get_continue_watching().map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_all_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    state.db.get_all_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_save_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    state
        .db
        .save_setting(&key, &value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_setting(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_save_download_meta(
    state: State<'_, AppState>,
    item: DownloadedEpisodeMeta,
) -> Result<(), String> {
    state
        .db
        .save_downloaded_episode(&item)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_download_meta(
    state: State<'_, AppState>,
    episode_id: String,
) -> Result<Option<DownloadedEpisodeMeta>, String> {
    state
        .db
        .get_downloaded_episode(&episode_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_get_all_downloaded_episodes(
    state: State<'_, AppState>,
) -> Result<Vec<DownloadedEpisodeMeta>, String> {
    state
        .db
        .get_all_downloaded_episodes()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn db_delete_download_meta(
    state: State<'_, AppState>,
    episode_id: String,
) -> Result<(), String> {
    state
        .db
        .delete_downloaded_episode(&episode_id)
        .map_err(|e| e.to_string())
}
