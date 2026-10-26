pub mod api;
mod commands;
pub mod db;
pub mod downloader;
pub mod player;
mod state;

pub use state::AppState;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use api::AnilibriaClient;
use db::Database;
use downloader::{HlsDownloader, TorrentDownloader, TorrentEngine};

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
    let torrent_downloader = Arc::new(TorrentDownloader::new());
    let torrent_engine = tauri::async_runtime::block_on(async {
        TorrentEngine::new(app_dir.clone(), database.clone()).await
    })
    .expect("Fatal: Torrent engine initialization failed");
    let torrent_engine = Arc::new(torrent_engine);
    let player_state = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: database,
            api: api_client,
            downloader,
            torrent_downloader,
            torrent_engine,
            player: player_state,
            app_dir,
        })
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
            commands::api::api_get_release_torrents,
            commands::api::api_get_release_franchises,
            commands::api::api_search_releases,
            commands::downloads::downloader_start_episode,
            commands::downloads::downloader_start_release,
            commands::downloads::downloader_cancel_episode,
            commands::downloads::downloader_cancel_all,
            commands::downloads::downloader_delete_episode,
            commands::downloads::downloader_open_folder,
            commands::downloads::downloader_download_torrent,
            commands::downloads::downloader_open_magnet,
            commands::downloads::downloader_start_torrent,
            commands::downloads::downloader_cancel_torrent,
            commands::player::player_init,
            commands::player::player_load_video,
            commands::player::player_play,
            commands::player::player_pause,
            commands::player::player_stop,
            commands::player::player_seek,
            commands::player::player_seek_relative,
            commands::player::player_set_volume,
            commands::player::player_get_volume,
            commands::player::player_set_speed,
            commands::player::player_set_shader_preset,
            commands::player::player_get_current_preset,
            commands::player::player_get_time_pos,
            commands::player::player_get_duration,
            commands::player::player_is_paused,
            commands::app::app_set_fullscreen,
            commands::app::app_is_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
