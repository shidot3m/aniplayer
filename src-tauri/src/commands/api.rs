use tauri::State;

use crate::api::models::{
    ApiStatus, FranchiseItem, GenreItem, GenreReleasesPage, ReleaseDetails, ReleasePreview,
};
use crate::state::AppState;

#[tauri::command]
pub(crate) async fn api_get_status(state: State<'_, AppState>) -> Result<ApiStatus, String> {
    state.api.get_status().await
}

#[tauri::command]
pub(crate) async fn api_get_latest_releases(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<ReleasePreview>, String> {
    state.api.get_latest_releases(limit.unwrap_or(20)).await
}

#[tauri::command]
pub(crate) async fn api_get_schedule_week(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    state.api.get_schedule_week().await
}

#[tauri::command]
pub(crate) async fn api_get_genres(state: State<'_, AppState>) -> Result<Vec<GenreItem>, String> {
    state.api.get_genres().await
}

#[tauri::command]
pub(crate) async fn api_get_genre_releases(
    state: State<'_, AppState>,
    genre_id: i64,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<GenreReleasesPage, String> {
    state
        .api
        .get_genre_releases(genre_id, page.unwrap_or(1), limit.unwrap_or(30))
        .await
}

#[tauri::command]
pub(crate) async fn api_get_release(
    state: State<'_, AppState>,
    id_or_alias: String,
) -> Result<ReleaseDetails, String> {
    state.api.get_release(&id_or_alias).await
}

#[tauri::command]
pub(crate) async fn api_get_release_franchises(
    state: State<'_, AppState>,
    release_id: i64,
) -> Result<Vec<FranchiseItem>, String> {
    state.api.get_release_franchises(release_id).await
}

#[tauri::command]
pub(crate) async fn api_search_releases(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<ReleasePreview>, String> {
    state.api.search_releases(&query).await
}
