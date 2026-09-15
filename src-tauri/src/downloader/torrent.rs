use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use std::path::{Path, PathBuf};
use tokio::fs;

pub struct TorrentDownloader {
    client: Client,
}

impl Default for TorrentDownloader {
    fn default() -> Self {
        Self::new()
    }
}

impl TorrentDownloader {
    pub fn new() -> Self {
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
        Self { client }
    }

    pub async fn download_torrent_file(
        &self,
        base_dir: &Path,
        torrent_id: i64,
        suggested_filename: &str,
    ) -> Result<PathBuf, String> {
        let torrents_folder = base_dir.join("downloads").join("torrents");
        fs::create_dir_all(&torrents_folder)
            .await
            .map_err(|e| e.to_string())?;

        let clean_filename = if suggested_filename.ends_with(".torrent") {
            suggested_filename.to_string()
        } else {
            format!("{}.torrent", suggested_filename)
        };

        let sanitized: String = clean_filename
            .chars()
            .map(|c| match c {
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
                _ => c,
            })
            .collect();

        let dest_path = torrents_folder.join(&sanitized);
        let base_url = crate::api::client::ApiConfig::default().base_url;
        let url = format!("{}/anime/torrents/{}/file", base_url, torrent_id);

        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Server returned error status: {}", resp.status()));
        }

        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        fs::write(&dest_path, &bytes)
            .await
            .map_err(|e| e.to_string())?;

        Ok(dest_path)
    }

    pub fn open_magnet(magnet_url: &str) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", magnet_url])
                .spawn()
                .map_err(|e| format!("Failed to open magnet link: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("xdg-open")
                .arg(magnet_url)
                .spawn()
                .map_err(|e| format!("Failed to open magnet link: {}", e))?;
        }
        Ok(())
    }

    pub fn open_torrent_file(path: &Path) -> Result<(), String> {
        let path_str = path.to_string_lossy().to_string();
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", &path_str])
                .spawn()
                .map_err(|e| format!("Failed to open torrent file: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("xdg-open")
                .arg(&path_str)
                .spawn()
                .map_err(|e| format!("Failed to open torrent file: {}", e))?;
        }
        Ok(())
    }
}
