use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

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

        let file_name = format!("{}.mp4", ordinal);
        let dest_path = rel_folder.join(&file_name);
        let dest_str = dest_path.to_string_lossy().to_string();

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
            self.cleanup_cancelled(spec, &dest_path, &app).await;
            return Err("Download cancelled by user".to_string());
        }

        // 1. Fetch m3u8 playlist
        let playlist_resp = match self.client.get(m3u8_url).send().await {
            Ok(r) => r,
            Err(e) => {
                let err_msg = format!("Failed to fetch m3u8 playlist: {}", e);
                return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
            }
        };

        let playlist_text = match playlist_resp.text().await {
            Ok(t) => t,
            Err(e) => {
                let err_msg = format!("Failed to read m3u8 body: {}", e);
                return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
            }
        };

        if cancel_flag.load(Ordering::Relaxed) {
            self.cleanup_cancelled(spec, &dest_path, &app).await;
            return Err("Download cancelled by user".to_string());
        }

        // 2. Parse segment URLs
        let base_url = if let Some(idx) = m3u8_url.rfind('/') {
            &m3u8_url[..=idx]
        } else {
            m3u8_url
        };

        let mut segment_urls = Vec::new();
        for line in playlist_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                segment_urls.push(trimmed.to_string());
            } else {
                segment_urls.push(format!("{}{}", base_url, trimmed));
            }
        }

        if segment_urls.is_empty() {
            let err_msg = "No media segments found in m3u8 playlist".to_string();
            return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
        }

        let total_segments = segment_urls.len();

        // 3. Download and stitch segments
        let mut outfile = match File::create(&dest_path).await {
            Ok(f) => f,
            Err(e) => {
                let err_msg = format!("Failed to create destination file: {}", e);
                return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
            }
        };

        let mut total_bytes = 0i64;

        for (i, seg_url) in segment_urls.into_iter().enumerate() {
            if cancel_flag.load(Ordering::Relaxed) {
                drop(outfile);
                self.cleanup_cancelled(spec, &dest_path, &app).await;
                return Err("Download cancelled by user".to_string());
            }

            let seg_resp = match self.client.get(&seg_url).send().await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = format!("Segment {} network request error: {}", i, e);
                    return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
                }
            };

            let bytes = match seg_resp.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    let err_msg = format!("Segment {} bytes read error: {}", i, e);
                    return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
                }
            };

            if cancel_flag.load(Ordering::Relaxed) {
                drop(outfile);
                self.cleanup_cancelled(spec, &dest_path, &app).await;
                return Err("Download cancelled by user".to_string());
            }

            total_bytes += bytes.len() as i64;
            if let Err(e) = outfile.write_all(&bytes).await {
                let err_msg = format!("File write error: {}", e);
                return Err(self.record_failure_and_stop(spec, &dest_str, err_msg, &app));
            }

            let downloaded = i + 1;
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
                        status: if downloaded == total_segments {
                            "COMPLETED".to_string()
                        } else {
                            "DOWNLOADING".to_string()
                        },
                        error: None,
                    },
                );
            }
        }

        let _ = outfile.flush().await;

        // 4. Update status to COMPLETED
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
        self.remove_task(episode_id);

        Ok(dest_path)
    }

    async fn cleanup_cancelled(
        &self,
        spec: &EpisodeDownloadSpec<'_>,
        dest_path: &Path,
        app: &Option<tauri::AppHandle>,
    ) {
        let _ = fs::remove_file(dest_path).await;
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

    fn record_failure_and_stop(
        &self,
        spec: &EpisodeDownloadSpec<'_>,
        file_path: &str,
        error_msg: String,
        app: &Option<tauri::AppHandle>,
    ) -> String {
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
