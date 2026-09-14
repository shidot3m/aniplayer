use std::path::{Path, PathBuf};
use std::sync::Arc;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;

pub struct HlsDownloader {
    client: Client,
    db: Arc<Database>,
}

impl HlsDownloader {
    pub fn new(db: Arc<Database>) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 Aniplayer/1.0"),
        );
        let client = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client, db }
    }

    pub async fn download_episode(
        &self,
        base_dir: &Path,
        episode_id: &str,
        release_id: i64,
        ordinal: f64,
        m3u8_url: &str,
        quality: &str,
        op_start: Option<f64>,
        op_stop: Option<f64>,
        ed_start: Option<f64>,
        ed_stop: Option<f64>,
    ) -> Result<PathBuf, String> {
        let rel_folder = base_dir.join("downloads").join(release_id.to_string());
        fs::create_dir_all(&rel_folder).await.map_err(|e| e.to_string())?;

        let file_name = format!("{}.mp4", ordinal);
        let dest_path = rel_folder.join(&file_name);

        // Record pending status
        let meta = DownloadedEpisodeMeta {
            episode_id: episode_id.to_string(),
            release_id,
            episode_ordinal: ordinal,
            file_path: dest_path.to_string_lossy().to_string(),
            file_size: 0,
            quality: quality.to_string(),
            opening_start: op_start,
            opening_stop: op_stop,
            ending_start: ed_start,
            ending_stop: ed_stop,
            download_status: "DOWNLOADING".to_string(),
        };
        let _ = self.db.save_downloaded_episode(&meta);

        // 1. Fetch m3u8 playlist
        let playlist_text = self.client.get(m3u8_url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .text()
            .await
            .map_err(|e| e.to_string())?;

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
            return Err("No media segments found in m3u8 playlist".to_string());
        }

        // 3. Download and stitch segments
        let mut outfile = File::create(&dest_path).await.map_err(|e| e.to_string())?;
        let mut total_bytes = 0i64;

        for seg_url in segment_urls {
            let bytes = self.client.get(&seg_url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .bytes()
                .await
                .map_err(|e| e.to_string())?;
            total_bytes += bytes.len() as i64;
            outfile.write_all(&bytes).await.map_err(|e| e.to_string())?;
        }
        outfile.flush().await.map_err(|e| e.to_string())?;

        // 4. Update status to COMPLETED
        let completed_meta = DownloadedEpisodeMeta {
            episode_id: episode_id.to_string(),
            release_id,
            episode_ordinal: ordinal,
            file_path: dest_path.to_string_lossy().to_string(),
            file_size: total_bytes,
            quality: quality.to_string(),
            opening_start: op_start,
            opening_stop: op_stop,
            ending_start: ed_start,
            ending_stop: ed_stop,
            download_status: "COMPLETED".to_string(),
        };
        let _ = self.db.save_downloaded_episode(&completed_meta);

        Ok(dest_path)
    }
}
