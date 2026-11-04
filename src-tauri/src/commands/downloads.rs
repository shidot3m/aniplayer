use std::path::{Path, PathBuf};

use tauri::State;

use crate::downloader::EpisodeDownloadSpec;
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

impl DownloadEpisodeItem {
    fn as_spec<'a>(&'a self, release_id: i64, quality: &'a str) -> EpisodeDownloadSpec<'a> {
        EpisodeDownloadSpec {
            episode_id: &self.episode_id,
            release_id,
            ordinal: self.ordinal,
            m3u8_url: &self.m3u8_url,
            quality,
            op_start: self.op_start,
            op_stop: self.op_stop,
            ed_start: self.ed_start,
            ed_stop: self.ed_stop,
        }
    }
}

#[tauri::command]
pub(crate) async fn downloader_start_episode(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    mut episode: DownloadEpisodeItem,
    release_id: i64,
) -> Result<String, String> {
    let quality = episode
        .quality
        .take()
        .ok_or_else(|| "quality is required to download an episode".to_string())?;
    let downloader = state.downloader.clone();
    let app_dir = state.app_dir.clone();
    let ordinal = episode.ordinal;

    tokio::spawn(async move {
        let spec = episode.as_spec(release_id, &quality);
        let _ = downloader
            .download_episode(&app_dir, &spec, Some(app))
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
    let queue = downloader.begin_release(release_id);

    tokio::spawn(async move {
        for mut ep in episodes {
            if queue.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            let quality = ep.quality.take().unwrap_or_else(|| "1080p".to_string());
            let spec = ep.as_spec(release_id, &quality);
            let _ = downloader
                .download_episode(&app_dir, &spec, Some(app.clone()))
                .await;
        }
        downloader.end_release(release_id, &queue);
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
            remove_download_storage(&state.app_dir, &meta.file_path).await;
        }
    }
    state
        .db
        .delete_downloaded_episode(&episode_id)
        .map_err(|e| e.to_string())
}

/// Removes the storage an episode owns: the whole folder of an HLS download
/// (playlist plus segments), or the single file a pre-playlist layout left
/// behind.
async fn remove_download_storage(app_dir: &Path, file_path: &str) {
    let path = PathBuf::from(file_path);
    let downloads_root = app_dir.join("downloads");
    if !path.starts_with(&downloads_root) {
        return;
    }

    let is_playlist = path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("m3u8"));
    if is_playlist {
        if let Some(folder) = path.parent() {
            if folder != downloads_root {
                let _ = tokio::fs::remove_dir_all(folder).await;
            }
        }
    } else if path.exists() {
        let _ = tokio::fs::remove_file(&path).await;
    }
}

#[tauri::command]
pub(crate) fn downloader_open_folder(
    state: State<'_, AppState>,
    release_id: Option<i64>,
) -> Result<(), String> {
    let folder = folder_for_release(&state.app_dir, release_id);
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    tauri_plugin_opener::open_path(&folder, None::<&str>).map_err(|e| e.to_string())?;
    Ok(())
}

fn folder_for_release(app_dir: &Path, release_id: Option<i64>) -> PathBuf {
    match release_id {
        Some(id) => app_dir.join("downloads").join(id.to_string()),
        None => app_dir.join("downloads"),
    }
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
