use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;
use std::path::{Path, PathBuf};
use tokio::fs;

const MAX_MAGNET_LEN: usize = 4096;

pub fn torrents_root(base_dir: &Path) -> PathBuf {
    base_dir.join("downloads").join("torrents")
}

pub fn validate_magnet(magnet_url: &str) -> Result<(), String> {
    if !magnet_url.starts_with("magnet:?") {
        return Err("Invalid magnet link: wrong scheme".to_string());
    }
    if magnet_url.len() > MAX_MAGNET_LEN {
        return Err(format!(
            "Invalid magnet link: exceeds {} characters",
            MAX_MAGNET_LEN
        ));
    }
    if magnet_url.chars().any(|c| c.is_control()) {
        return Err("Invalid magnet link: contains control characters".to_string());
    }
    Ok(())
}

pub fn validate_torrent_path(path: &Path, downloads_root: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|_| "Torrent file not found".to_string())?;
    let root = downloads_root
        .canonicalize()
        .map_err(|_| "Torrents downloads folder not found".to_string())?;
    if canonical.starts_with(&root) {
        Ok(canonical)
    } else {
        Err("Torrent file is outside the downloads folder".to_string())
    }
}

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
        let torrents_folder = torrents_root(base_dir);
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

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
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
        validate_magnet(magnet_url)?;
        tauri_plugin_opener::open_url(magnet_url, None::<&str>)
            .map_err(|e| format!("Failed to open magnet link: {}", e))
    }

    pub fn open_torrent_file(path: &Path, downloads_root: &Path) -> Result<(), String> {
        let validated = validate_torrent_path(path, downloads_root)?;
        tauri_plugin_opener::open_path(validated, None::<&str>)
            .map_err(|e| format!("Failed to open torrent file: {}", e))
    }
}
