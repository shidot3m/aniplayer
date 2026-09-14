pub mod api;
pub mod db;
pub mod downloader;
pub mod player;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;
use api::models::*;
use api::AnilibriaClient;
use db::models::*;
use db::Database;
use downloader::HlsDownloader;
use player::MpvCore;

pub struct AppState {
    pub db: Arc<Database>,
    pub api: Arc<AnilibriaClient>,
    pub downloader: Arc<HlsDownloader>,
    pub player: Arc<Mutex<Option<MpvCore>>>,
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

#[tauri::command]
fn db_get_all_downloaded_episodes(state: State<'_, AppState>) -> Result<Vec<DownloadedEpisodeMeta>, String> {
    state.db.get_all_downloaded_episodes().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_download_meta(state: State<'_, AppState>, episode_id: String) -> Result<(), String> {
    state.db.delete_downloaded_episode(&episode_id).map_err(|e| e.to_string())
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
async fn api_get_release_franchises(state: State<'_, AppState>, release_id: i64) -> Result<Vec<FranchiseItem>, String> {
    state.api.get_release_franchises(release_id).await
}

#[tauri::command]
async fn api_search_releases(state: State<'_, AppState>, query: String) -> Result<Vec<ReleasePreview>, String> {
    state.api.search_releases(&query).await
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadEpisodeItem {
    #[serde(alias = "episode_id")]
    pub episode_id: String,
    pub ordinal: f64,
    #[serde(alias = "m3u8_url")]
    pub m3u8_url: String,
    pub quality: Option<String>,
    #[serde(alias = "op_start")]
    pub op_start: Option<f64>,
    #[serde(alias = "op_stop")]
    pub op_stop: Option<f64>,
    #[serde(alias = "ed_start")]
    pub ed_start: Option<f64>,
    #[serde(alias = "ed_stop")]
    pub ed_stop: Option<f64>,
}

// Downloader IPC commands
#[tauri::command]
async fn downloader_start_episode(
    app: tauri::AppHandle,
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
    let downloader = state.downloader.clone();
    let app_dir = state.app_dir.clone();

    tokio::spawn(async move {
        let _ = downloader.download_episode(
            &app_dir,
            &episode_id,
            release_id,
            ordinal,
            &m3u8_url,
            &quality,
            op_start,
            op_stop,
            ed_start,
            ed_stop,
            Some(app),
        ).await;
    });

    Ok(format!("Started downloading episode {}", ordinal))
}

#[tauri::command]
async fn downloader_start_release(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    release_id: i64,
    episodes: Vec<DownloadEpisodeItem>,
) -> Result<usize, String> {
    if episodes.is_empty() {
        return Err("No episodes provided for download".to_string());
    }

    let count = episodes.len();
    let downloader = state.downloader.clone();
    let app_dir = state.app_dir.clone();

    tokio::spawn(async move {
        for ep in episodes {
            let quality = ep.quality.unwrap_or_else(|| "1080p".to_string());
            let _ = downloader.download_episode(
                &app_dir,
                &ep.episode_id,
                release_id,
                ep.ordinal,
                &ep.m3u8_url,
                &quality,
                ep.op_start,
                ep.op_stop,
                ep.ed_start,
                ep.ed_stop,
                Some(app.clone()),
            ).await;
        }
    });

    Ok(count)
}

#[tauri::command]
async fn downloader_delete_episode(
    state: State<'_, AppState>,
    episode_id: String,
    delete_file: Option<bool>,
) -> Result<(), String> {
    if delete_file.unwrap_or(true) {
        if let Ok(Some(meta)) = state.db.get_downloaded_episode(&episode_id) {
            let path = PathBuf::from(&meta.file_path);
            if path.exists() {
                let _ = tokio::fs::remove_file(&path).await;
            }
        }
    }
    state.db.delete_downloaded_episode(&episode_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn downloader_open_folder(
    state: State<'_, AppState>,
    release_id: Option<i64>,
) -> Result<(), String> {
    let folder = if let Some(id) = release_id {
        state.app_dir.join("downloads").join(id.to_string())
    } else {
        state.app_dir.join("downloads")
    };
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = folder;
    }
    Ok(())
}

// Player IPC commands
#[tauri::command]
fn player_init(state: State<'_, AppState>, hwnd: Option<usize>) -> Result<(), String> {
    let dll_candidates = [
        state.app_dir.join("bin/mpv-dev/libmpv-2.dll"),
        state.app_dir.join("libmpv-2.dll"),
        PathBuf::from("bin/mpv-dev/libmpv-2.dll"),
        PathBuf::from("libmpv-2.dll"),
        PathBuf::from("../bin/mpv-dev/libmpv-2.dll"),
        PathBuf::from("dist_portable/libmpv-2.dll"),
        PathBuf::from("../dist_portable/libmpv-2.dll"),
    ];
    let dll_path = dll_candidates.into_iter().find(|p| p.exists())
        .ok_or_else(|| "libmpv-2.dll not found".to_string())?;
    
    let shaders_candidates = [
        state.app_dir.join("shaders/anime4k"),
        PathBuf::from("shaders/anime4k"),
        PathBuf::from("../shaders/anime4k"),
        PathBuf::from("dist_portable/shaders/anime4k"),
        PathBuf::from("../dist_portable/shaders/anime4k"),
    ];
    let shaders_dir = shaders_candidates.into_iter().find(|p| p.exists())
        .unwrap_or_else(|| state.app_dir.join("shaders/anime4k"));

    let core = MpvCore::new(&dll_path, &shaders_dir, hwnd)?;
    let initial_vol = if let Ok(Some(val)) = state.db.get_setting("volume") {
        val.parse::<f64>().unwrap_or(80.0)
    } else {
        80.0
    };
    let _ = core.set_volume(initial_vol);
    let mut p = state.player.lock().map_err(|e| e.to_string())?;
    *p = Some(core);
    Ok(())
}

#[tauri::command]
fn player_load_video(state: State<'_, AppState>, url: String, start_pos: Option<f64>) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.load_video(&url, start_pos.unwrap_or(0.0))
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_play(state: State<'_, AppState>) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.play()
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_pause(state: State<'_, AppState>) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.pause()
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_seek(state: State<'_, AppState>, seconds: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.seek(seconds)
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_seek_relative(state: State<'_, AppState>, offset: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.seek_relative(offset)
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_set_volume(state: State<'_, AppState>, volume: f64) -> Result<(), String> {
    let _ = state.db.save_setting("volume", &format!("{:.1}", volume));
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.set_volume(volume);
    }
    Ok(())
}

#[tauri::command]
fn player_get_volume(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_volume()
    } else if let Ok(Some(val)) = state.db.get_setting("volume") {
        Ok(val.parse::<f64>().unwrap_or(80.0))
    } else {
        Ok(80.0)
    }
}

#[tauri::command]
fn player_set_speed(state: State<'_, AppState>, speed: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.set_speed(speed)
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_set_shader_preset(state: State<'_, AppState>, preset: String) -> Result<(), String> {
    let mut p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_mut() {
        core.set_shader_preset(&preset)?;
        let _ = state.db.save_setting("anime4k_preset", &preset);
        Ok(())
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
fn player_get_current_preset(state: State<'_, AppState>) -> Result<String, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        Ok(core.get_current_preset())
    } else {
        Ok("A+A".to_string())
    }
}

#[tauri::command]
fn player_get_time_pos(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_time_pos()
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
fn player_get_duration(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_duration()
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
fn player_is_paused(state: State<'_, AppState>) -> Result<bool, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.is_paused()
    } else {
        Ok(true)
    }
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
    let player_state = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: database,
            api: api_client,
            downloader,
            player: player_state,
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
            db_get_all_downloaded_episodes,
            db_delete_download_meta,
            api_get_status,
            api_get_latest_releases,
            api_get_schedule_week,
            api_get_genres,
            api_get_genre_releases,
            api_get_release,
            api_get_release_torrents,
            api_get_release_franchises,
            api_search_releases,
            downloader_start_episode,
            downloader_start_release,
            downloader_delete_episode,
            downloader_open_folder,
            player_init,
            player_load_video,
            player_play,
            player_pause,
            player_seek,
            player_seek_relative,
            player_set_volume,
            player_get_volume,
            player_set_speed,
            player_set_shader_preset,
            player_get_current_preset,
            player_get_time_pos,
            player_get_duration,
            player_is_paused,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
