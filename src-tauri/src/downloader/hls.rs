use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::fs;

/// The playlist file written into every downloaded episode folder.
pub const PLAYLIST_FILE_NAME: &str = "index.m3u8";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub episode_id: String,
    pub release_id: i64,
    pub episode_ordinal: f64,
    pub total_segments: usize,
    pub downloaded_segments: usize,
    pub total_bytes: i64,
    pub percent: f64,
    pub status: String, // "DOWNLOADING", "COMPLETED", "FAILED", "CANCELLED"
    pub error: Option<String>,
}

/// Episode metadata required to download a single stream.
#[derive(Debug, Clone, Copy)]
pub struct EpisodeDownloadSpec<'a> {
    pub episode_id: &'a str,
    pub release_id: i64,
    pub ordinal: f64,
    pub m3u8_url: &'a str,
    pub quality: &'a str,
    pub op_start: Option<f64>,
    pub op_stop: Option<f64>,
    pub ed_start: Option<f64>,
    pub ed_stop: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalResource {
    pub file_name: String,
    pub url: String,
}

/// A downloaded HLS stream: media segments, initialization/key resources, and the
/// playlist that points at all of them once they are on disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalPlaylist {
    pub segment_urls: Vec<String>,
    pub resources: Vec<LocalResource>,
    pub manifest: String,
}

pub fn segment_file_name(index: usize) -> String {
    format!("segment-{index:05}.ts")
}

fn localize_uri_attribute(
    line: &str,
    base: &Url,
    file_name: String,
) -> Result<(String, LocalResource), String> {
    let start = line
        .find("URI=\"")
        .map(|index| index + 5)
        .ok_or_else(|| format!("HLS tag has no quoted URI: {line}"))?;
    let relative_end = line[start..]
        .find('"')
        .ok_or_else(|| format!("HLS tag has an unterminated URI: {line}"))?;
    let end = start + relative_end;
    let resolved = base
        .join(&line[start..end])
        .map_err(|e| format!("Invalid HLS resource URI: {e}"))?;
    let rewritten = format!("{}{file_name}{}", &line[..start], &line[end..]);
    Ok((
        rewritten,
        LocalResource {
            file_name,
            url: resolved.to_string(),
        },
    ))
}

/// Turns a remote media playlist into a self-contained one whose media and key/map
/// URIs are local file names. mpv reads the result directly, without the network.
pub fn prepare_local_playlist(
    playlist_text: &str,
    playlist_url: &str,
) -> Result<LocalPlaylist, String> {
    let base = Url::parse(playlist_url).map_err(|e| format!("Invalid HLS playlist URL: {e}"))?;

    let mut manifest_lines: Vec<String> = Vec::new();
    let mut segment_urls: Vec<String> = Vec::new();
    let mut resources: Vec<LocalResource> = Vec::new();
    let mut map_count = 0usize;
    let mut key_count = 0usize;
    let mut has_endlist = false;

    for line in playlist_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with('#') {
            if trimmed.starts_with("#EXT-X-STREAM-INF") {
                return Err(
                    "HLS master playlists are not supported; download a Quality stream instead"
                        .to_string(),
                );
            }
            if trimmed.starts_with("#EXT-X-BYTERANGE") {
                return Err(
                    "HLS byte-range playlists cannot be stored offline; download each segment as a file instead"
                        .to_string(),
                );
            }
            let resource_name = if trimmed.starts_with("#EXT-X-MAP:") {
                let name = format!("init-{map_count:05}.mp4");
                map_count += 1;
                Some(name)
            } else if trimmed.starts_with("#EXT-X-KEY:") && !trimmed.contains("METHOD=NONE") {
                let name = format!("key-{key_count:05}.key");
                key_count += 1;
                Some(name)
            } else {
                None
            };
            if let Some(file_name) = resource_name {
                let (rewritten, resource) = localize_uri_attribute(trimmed, &base, file_name)?;
                manifest_lines.push(rewritten);
                resources.push(resource);
            } else {
                manifest_lines.push(trimmed.to_string());
            }
            if trimmed.starts_with("#EXT-X-ENDLIST") {
                has_endlist = true;
            }
            continue;
        }

        let resolved = base
            .join(trimmed)
            .map_err(|e| format!("Invalid segment URI `{trimmed}`: {e}"))?;
        manifest_lines.push(segment_file_name(segment_urls.len()));
        segment_urls.push(resolved.to_string());
    }

    if segment_urls.is_empty() {
        return Err("No media segments found in m3u8 playlist".to_string());
    }
    if !manifest_lines
        .first()
        .is_some_and(|line| line.starts_with("#EXTM3U"))
    {
        manifest_lines.insert(0, "#EXTM3U".to_string());
    }
    if !has_endlist {
        manifest_lines.push("#EXT-X-ENDLIST".to_string());
    }

    let mut manifest = manifest_lines.join("\n");
    manifest.push('\n');

    Ok(LocalPlaylist {
        segment_urls,
        resources,
        manifest,
    })
}

pub struct HlsDownloader {
    client: Client,
    db: Arc<Database>,
    active_tasks: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl HlsDownloader {
    pub fn new(db: Arc<Database>) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Aniplayer/1.0"),
        );
        let client = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            db,
            active_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn cancel_episode(&self, episode_id: &str, app: Option<&tauri::AppHandle>) -> bool {
        let mut tasks = self.active_tasks.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(flag) = tasks.remove(episode_id) {
            flag.store(true, Ordering::Relaxed);
            let _ = self.db.delete_downloaded_episode(episode_id);
            if let Some(a) = app {
                let _ = a.emit(
                    "download-progress",
                    DownloadProgressEvent {
                        episode_id: episode_id.to_string(),
                        release_id: 0,
                        episode_ordinal: 0.0,
                        total_segments: 0,
                        downloaded_segments: 0,
                        total_bytes: 0,
                        percent: 0.0,
                        status: "CANCELLED".to_string(),
                        error: Some("Download cancelled by user".to_string()),
                    },
                );
            }
            true
        } else {
            false
        }
    }

    pub fn cancel_all(&self, app: Option<&tauri::AppHandle>) {
        let mut tasks = self.active_tasks.lock().unwrap_or_else(|e| e.into_inner());
        for (ep_id, flag) in tasks.drain() {
            flag.store(true, Ordering::Relaxed);
            let _ = self.db.delete_downloaded_episode(&ep_id);
            if let Some(a) = app {
                let _ = a.emit(
                    "download-progress",
                    DownloadProgressEvent {
                        episode_id: ep_id,
                        release_id: 0,
                        episode_ordinal: 0.0,
                        total_segments: 0,
                        downloaded_segments: 0,
                        total_bytes: 0,
                        percent: 0.0,
                        status: "CANCELLED".to_string(),
                        error: Some("All downloads cancelled".to_string()),
                    },
                );
            }
        }
    }

    pub async fn download_episode(
        &self,
        base_dir: &Path,
        spec: &EpisodeDownloadSpec<'_>,
        app: Option<tauri::AppHandle>,
    ) -> Result<PathBuf, String> {
        let EpisodeDownloadSpec {
            episode_id,
            release_id,
            ordinal,
            m3u8_url,
            quality,
            op_start,
            op_stop,
            ed_start,
            ed_stop,
        } = *spec;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut tasks = self.active_tasks.lock().unwrap_or_else(|e| e.into_inner());
            // If already downloading, cancel previous task first for clean synchronization
            if let Some(old_flag) = tasks.get(episode_id) {
                old_flag.store(true, Ordering::Relaxed);
            }
            tasks.insert(episode_id.to_string(), cancel_flag.clone());
        }

        let rel_folder = base_dir.join("downloads").join(release_id.to_string());
        fs::create_dir_all(&rel_folder)
            .await
            .map_err(|e| e.to_string())?;

        // Every episode owns a folder with its playlist and the resources the
        // playlist names, so mpv can replay it offline with no network access.
        let episode_dir = rel_folder.join(ordinal.to_string());
        let dest_path = episode_dir.join(PLAYLIST_FILE_NAME);
        let dest_str = dest_path.to_string_lossy().to_string();

        macro_rules! fail {
            ($message:expr) => {{
                return Err(self
                    .record_failure_and_stop(spec, &episode_dir, &dest_str, $message, &app)
                    .await);
            }};
        }

        let legacy_file = rel_folder.join(format!("{}.mp4", ordinal));
        if fs::try_exists(&legacy_file).await.unwrap_or(false) {
            let _ = fs::remove_file(&legacy_file).await;
        }
        let _ = fs::remove_dir_all(&episode_dir).await;
        if let Err(e) = fs::create_dir_all(&episode_dir).await {
            fail!(format!("Failed to create episode folder: {e}"));
        }

        // Record downloading status in DB
        let meta = DownloadedEpisodeMeta {
            episode_id: episode_id.to_string(),
            release_id,
            episode_ordinal: ordinal,
            file_path: dest_str.clone(),
            file_size: 0,
            quality: quality.to_string(),
            opening_start: op_start,
            opening_stop: op_stop,
            ending_start: ed_start,
            ending_stop: ed_stop,
            download_status: "DOWNLOADING".to_string(),
        };
        let _ = self.db.save_downloaded_episode(&meta);

        // Notify initial progress
        if let Some(ref a) = app {
            let _ = a.emit(
                "download-progress",
                DownloadProgressEvent {
                    episode_id: episode_id.to_string(),
                    release_id,
                    episode_ordinal: ordinal,
                    total_segments: 0,
                    downloaded_segments: 0,
                    total_bytes: 0,
                    percent: 0.0,
                    status: "DOWNLOADING".to_string(),
                    error: None,
                },
            );
        }

        if cancel_flag.load(Ordering::Relaxed) {
            self.cleanup_cancelled(spec, &episode_dir, &app).await;
            return Err("Download cancelled by user".to_string());
        }

        // 1. Fetch and rewrite the media playlist
        let playlist_text = match self.client.get(m3u8_url).send().await {
            Ok(response) => match response.text().await {
                Ok(text) => text,
                Err(e) => {
                    let err_msg = format!("Failed to read m3u8 body: {e}");
                    fail!(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to fetch m3u8 playlist: {e}");
                fail!(err_msg);
            }
        };

        if cancel_flag.load(Ordering::Relaxed) {
            self.cleanup_cancelled(spec, &episode_dir, &app).await;
            return Err("Download cancelled by user".to_string());
        }

        let playlist = match prepare_local_playlist(&playlist_text, m3u8_url) {
            Ok(playlist) => playlist,
            Err(err_msg) => fail!(err_msg),
        };

        // 2. Download initialization/key resources and media segments.
        let total_segments = playlist.segment_urls.len();
        let mut total_bytes = 0i64;

        for resource in &playlist.resources {
            if cancel_flag.load(Ordering::Relaxed) {
                self.cleanup_cancelled(spec, &episode_dir, &app).await;
                return Err("Download cancelled by user".to_string());
            }
            let response = match self.client.get(&resource.url).send().await {
                Ok(response) => response,
                Err(e) => fail!(format!("HLS resource network request error: {e}")),
            };
            let bytes = match response.bytes().await {
                Ok(bytes) => bytes,
                Err(e) => fail!(format!("HLS resource bytes read error: {e}")),
            };
            total_bytes += bytes.len() as i64;
            if let Err(e) = fs::write(episode_dir.join(&resource.file_name), &bytes).await {
                fail!(format!("HLS resource file write error: {e}"));
            }
        }

        for (index, segment_url) in playlist.segment_urls.iter().enumerate() {
            if cancel_flag.load(Ordering::Relaxed) {
                self.cleanup_cancelled(spec, &episode_dir, &app).await;
                return Err("Download cancelled by user".to_string());
            }

            let bytes = match self.client.get(segment_url).send().await {
                Ok(response) => match response.bytes().await {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        let err_msg = format!("Segment {index} bytes read error: {e}");
                        fail!(err_msg);
                    }
                },
                Err(e) => {
                    let err_msg = format!("Segment {index} network request error: {e}");
                    fail!(err_msg);
                }
            };

            if cancel_flag.load(Ordering::Relaxed) {
                self.cleanup_cancelled(spec, &episode_dir, &app).await;
                return Err("Download cancelled by user".to_string());
            }

            total_bytes += bytes.len() as i64;
            let segment_path = episode_dir.join(segment_file_name(index));
            if let Err(e) = fs::write(&segment_path, &bytes).await {
                let err_msg = format!("File write error: {e}");
                fail!(err_msg);
            }

            let downloaded = index + 1;
            let percent = ((downloaded as f64 / total_segments as f64) * 1000.0).round() / 10.0;

            if let Some(ref a) = app {
                let _ = a.emit(
                    "download-progress",
                    DownloadProgressEvent {
                        episode_id: episode_id.to_string(),
                        release_id,
                        episode_ordinal: ordinal,
                        total_segments,
                        downloaded_segments: downloaded,
                        total_bytes,
                        percent,
                        status: "DOWNLOADING".to_string(),
                        error: None,
                    },
                );
            }
        }

        // 3. Write the local playlist last: its presence marks a complete episode
        let manifest = playlist.manifest.into_bytes();
        total_bytes += manifest.len() as i64;
        if let Err(e) = fs::write(&dest_path, &manifest).await {
            let err_msg = format!("Failed to write local playlist: {e}");
            fail!(err_msg);
        }

        let completed_meta = DownloadedEpisodeMeta {
            episode_id: episode_id.to_string(),
            release_id,
            episode_ordinal: ordinal,
            file_path: dest_str,
            file_size: total_bytes,
            quality: quality.to_string(),
            opening_start: op_start,
            opening_stop: op_stop,
            ending_start: ed_start,
            ending_stop: ed_stop,
            download_status: "COMPLETED".to_string(),
        };
        let _ = self.db.save_downloaded_episode(&completed_meta);

        if let Some(ref a) = app {
            let _ = a.emit(
                "download-progress",
                DownloadProgressEvent {
                    episode_id: episode_id.to_string(),
                    release_id,
                    episode_ordinal: ordinal,
                    total_segments,
                    downloaded_segments: total_segments,
                    total_bytes,
                    percent: 100.0,
                    status: "COMPLETED".to_string(),
                    error: None,
                },
            );
        }

        self.remove_task(episode_id);

        Ok(dest_path)
    }

    async fn cleanup_cancelled(
        &self,
        spec: &EpisodeDownloadSpec<'_>,
        episode_dir: &Path,
        app: &Option<tauri::AppHandle>,
    ) {
        let _ = fs::remove_dir_all(episode_dir).await;
        let _ = self.db.delete_downloaded_episode(spec.episode_id);
        self.remove_task(spec.episode_id);

        if let Some(ref a) = app {
            let _ = a.emit(
                "download-progress",
                DownloadProgressEvent {
                    episode_id: spec.episode_id.to_string(),
                    release_id: spec.release_id,
                    episode_ordinal: spec.ordinal,
                    total_segments: 0,
                    downloaded_segments: 0,
                    total_bytes: 0,
                    percent: 0.0,
                    status: "CANCELLED".to_string(),
                    error: Some("Download cancelled by user".to_string()),
                },
            );
        }
    }

    fn remove_task(&self, episode_id: &str) {
        let mut tasks = self.active_tasks.lock().unwrap_or_else(|e| e.into_inner());
        tasks.remove(episode_id);
    }

    async fn record_failure_and_stop(
        &self,
        spec: &EpisodeDownloadSpec<'_>,
        episode_dir: &Path,
        file_path: &str,
        error_msg: String,
        app: &Option<tauri::AppHandle>,
    ) -> String {
        // A failed episode must not leave a partial folder that looks playable.
        let _ = fs::remove_dir_all(episode_dir).await;

        let failed_meta = DownloadedEpisodeMeta {
            episode_id: spec.episode_id.to_string(),
            release_id: spec.release_id,
            episode_ordinal: spec.ordinal,
            file_path: file_path.to_string(),
            file_size: 0,
            quality: spec.quality.to_string(),
            opening_start: spec.op_start,
            opening_stop: spec.op_stop,
            ending_start: spec.ed_start,
            ending_stop: spec.ed_stop,
            download_status: "FAILED".to_string(),
        };
        let _ = self.db.save_downloaded_episode(&failed_meta);

        if let Some(ref a) = app {
            let _ = a.emit(
                "download-progress",
                DownloadProgressEvent {
                    episode_id: spec.episode_id.to_string(),
                    release_id: spec.release_id,
                    episode_ordinal: spec.ordinal,
                    total_segments: 0,
                    downloaded_segments: 0,
                    total_bytes: 0,
                    percent: 0.0,
                    status: "FAILED".to_string(),
                    error: Some(error_msg.clone()),
                },
            );
        }

        self.remove_task(spec.episode_id);
        error_msg
    }
}
