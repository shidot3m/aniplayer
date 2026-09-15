use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use librqbit::{AddTorrent, AddTorrentOptions, Session, SessionOptions};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::task::JoinHandle;
use crate::db::Database;
use crate::downloader::scanner::scan_and_index_torrent_files;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentDownloadProgress {
    pub id: String,
    pub release_id: i64,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: u64,
    pub peers: usize,
    pub status: String, // "DOWNLOADING", "COMPLETED", "ERROR", "CANCELED"
}

pub struct TorrentEngine {
    session: Arc<Session>,
    db: Arc<Database>,
    base_dir: PathBuf,
    active_tasks: Arc<Mutex<HashMap<i64, JoinHandle<()>>>>,
}

impl TorrentEngine {
    pub async fn new(base_dir: PathBuf, db: Arc<Database>) -> Result<Self, String> {
        let torrents_dir = base_dir.join("downloads").join("torrents");
        let _ = tokio::fs::create_dir_all(&torrents_dir).await;

        let session = Session::new_with_opts(
            torrents_dir.clone(),
            SessionOptions::default(),
        )
        .await
        .map_err(|e| format!("Failed to create torrent session: {}", e))?;

        Ok(Self {
            session,
            db,
            base_dir: torrents_dir,
            active_tasks: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn start_download(
        &self,
        app_handle: tauri::AppHandle,
        release_id: i64,
        torrent_id: i64,
        magnet_or_url: &str,
    ) -> Result<String, String> {
        let release_folder = self.base_dir.join(format!("{}", release_id));
        let _ = tokio::fs::create_dir_all(&release_folder).await;

        let add_opts = AddTorrentOptions {
            output_folder: Some(release_folder.to_string_lossy().to_string()),
            ..Default::default()
        };

        let add_torrent = if magnet_or_url.starts_with("magnet:") {
            AddTorrent::from_url(magnet_or_url)
        } else if magnet_or_url.starts_with("http://") || magnet_or_url.starts_with("https://") {
            AddTorrent::from_url(magnet_or_url)
        } else {
            return Err("Invalid torrent URL or magnet link".to_string());
        };

        let response = self
            .session
            .add_torrent(add_torrent, Some(add_opts))
            .await
            .map_err(|e| format!("Failed to add torrent: {}", e))?;

        let handle = match response {
            librqbit::AddTorrentResponse::Added(_, h) => h,
            librqbit::AddTorrentResponse::AlreadyManaged(_, h) => h,
            librqbit::AddTorrentResponse::ListOnly(_) => {
                return Err("Failed to start download: torrent returned list only".to_string());
            }
        };

        let download_id = format!("torrent-{}", torrent_id);
        let app_handle_clone = app_handle.clone();
        let db = self.db.clone();
        let release_folder_clone = release_folder.clone();
        let active_tasks = self.active_tasks.clone();

        let task = tokio::spawn(async move {
            let mut last_bytes = 0u64;
            let mut last_time = std::time::Instant::now();

            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                // Check torrent state
                let stats = handle.stats();
                let total_bytes = stats.total_bytes;
                let progress_bytes = stats.progress_bytes;

                let progress = if total_bytes > 0 {
                    (progress_bytes as f64 / total_bytes as f64) * 100.0
                } else {
                    0.0
                };

                let is_finished = stats.finished;

                let now = std::time::Instant::now();
                let delta_time = now.duration_since(last_time).as_secs_f64();
                let delta_bytes = progress_bytes.saturating_sub(last_bytes);
                let speed = if delta_time > 0.0 {
                    (delta_bytes as f64 / delta_time) as u64
                } else {
                    0
                };
                last_bytes = progress_bytes;
                last_time = now;

                let peers = stats
                    .live
                    .as_ref()
                    .map(|l| l.snapshot.peer_stats.live as usize)
                    .unwrap_or(0);

                let progress_event = TorrentDownloadProgress {
                    id: format!("torrent-{}", torrent_id),
                    release_id,
                    progress: (progress * 10.0).round() / 10.0,
                    downloaded_bytes: progress_bytes,
                    total_bytes,
                    speed,
                    peers,
                    status: if is_finished || progress >= 100.0 {
                        "COMPLETED".to_string()
                    } else {
                        "DOWNLOADING".to_string()
                    },
                };

                let _ = app_handle_clone.emit("download-progress", &progress_event);

                if is_finished || progress >= 100.0 {
                    // Automatically index downloaded video files into SQLite
                    let _ = scan_and_index_torrent_files(&release_folder_clone, release_id, &db);
                    let _ = app_handle_clone.emit("downloads-updated", ());
                    break;
                }
            }

            let mut tasks = active_tasks.lock().unwrap();
            tasks.remove(&torrent_id);
        });

        let mut tasks = self.active_tasks.lock().unwrap();
        tasks.insert(torrent_id, task);

        Ok(download_id)
    }

    pub fn cancel_download(&self, app_handle: &tauri::AppHandle, torrent_id: i64) -> Result<(), String> {
        let mut tasks = self.active_tasks.lock().unwrap();
        if let Some(handle) = tasks.remove(&torrent_id) {
            handle.abort();
            let _ = app_handle.emit(
                "download-progress",
                TorrentDownloadProgress {
                    id: format!("torrent-{}", torrent_id),
                    release_id: 0,
                    progress: 0.0,
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    speed: 0,
                    peers: 0,
                    status: "CANCELED".to_string(),
                },
            );
        }
        Ok(())
    }
}
