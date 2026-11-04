pub mod api;
mod commands;
pub mod db;
pub mod downloader;
pub mod playback;
pub mod startup;
mod state;

pub use startup::StartupError;
pub use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), StartupError> {
    let result = startup::bootstrap().and_then(run_with_state);
    if let Err(error) = &result {
        startup::report(error);
    }
    result
}

fn run_with_state(state: AppState) -> Result<(), StartupError> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::app::ping,
            commands::db::db_save_bookmark,
            commands::db::db_get_bookmarks,
            commands::db::db_delete_bookmark,
            commands::db::db_save_history,
            commands::db::db_get_continue_watching,
            commands::db::db_get_all_history,
            commands::db::db_save_setting,
            commands::db::db_get_setting,
            commands::db::db_save_download_meta,
            commands::db::db_get_download_meta,
            commands::db::db_get_all_downloaded_episodes,
            commands::db::db_delete_download_meta,
            commands::api::api_get_status,
            commands::api::api_get_latest_releases,
            commands::api::api_get_schedule_week,
            commands::api::api_get_genres,
            commands::api::api_get_genre_releases,
            commands::api::api_get_release,
            commands::api::api_get_release_franchises,
            commands::api::api_search_releases,
            commands::downloads::downloader_start_episode,
            commands::downloads::downloader_start_release,
            commands::downloads::downloader_cancel_episode,
            commands::downloads::downloader_cancel_all,
            commands::downloads::downloader_delete_episode,
            commands::downloads::downloader_open_folder,
            commands::app::app_set_fullscreen,
            commands::app::app_is_fullscreen,
            commands::player::player_resolve_source,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| StartupError::Run {
            reason: e.to_string(),
        })
}
