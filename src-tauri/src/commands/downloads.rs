use std::path::PathBuf;

use tauri::State;

use crate::downloader::TorrentDownloader;
use crate::state::AppState;

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

#[tauri::command]
pub(crate) async fn downloader_start_episode(
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
        let _ = downloader
            .download_episode(
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
            )
            .await;
    });

    Ok(format!("Started downloading episode {}", ordinal))
}

#[tauri::command]
pub(crate) async fn downloader_start_release(
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
            let _ = downloader
                .download_episode(
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
                )
                .await;
        }
    });

    Ok(count)
}

#[tauri::command]
pub(crate) async fn downloader_delete_episode(
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
    state
        .db
        .delete_downloaded_episode(&episode_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn downloader_open_folder(
    state: State<'_, AppState>,
    release_id: Option<i64>,
) -> Result<(), String> {
    let folder = if let Some(id) = release_id {
        state.app_dir.join("downloads").join(id.to_string())
    } else {
        state.app_dir.join("downloads")
    };
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    tauri_plugin_opener::open_path(&folder, None::<&str>).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) fn downloader_cancel_episode(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    episode_id: String,
) -> Result<bool, String> {
    Ok(state.downloader.cancel_episode(&episode_id, Some(&app)))
}

#[tauri::command]
pub(crate) fn downloader_cancel_all(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.downloader.cancel_all(Some(&app));
    Ok(())
}

#[tauri::command]
pub(crate) async fn downloader_download_torrent(
    state: State<'_, AppState>,
    torrent_id: i64,
    filename: String,
    auto_open: Option<bool>,
) -> Result<String, String> {
    let path = state
        .torrent_downloader
        .download_torrent_file(&state.app_dir, torrent_id, &filename)
        .await?;
    if auto_open.unwrap_or(true) {
        let torrents_root = crate::downloader::torrent::torrents_root(&state.app_dir);
        let _ = TorrentDownloader::open_torrent_file(&path, &torrents_root);
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) fn downloader_open_magnet(magnet: String) -> Result<(), String> {
    TorrentDownloader::open_magnet(&magnet)
}

#[tauri::command]
pub(crate) async fn downloader_start_torrent(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    release_id: i64,
    torrent_id: i64,
    magnet_or_url: String,
) -> Result<String, String> {
    state
        .torrent_engine
        .start_download(app, release_id, torrent_id, &magnet_or_url)
        .await
}

#[tauri::command]
pub(crate) fn downloader_cancel_torrent(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    torrent_id: i64,
) -> Result<(), String> {
    state.torrent_engine.cancel_download(&app, torrent_id)
}
