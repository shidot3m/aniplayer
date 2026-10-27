use crate::api::models::*;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::Client;

pub struct ApiConfig {
    pub base_url: String,
}

impl Default for ApiConfig {
    fn default() -> Self {
        let default_url = ["http", "s://", "aniliberty", ".top", "/api/v1"].concat();
        Self {
            base_url: std::env::var("ANILIBERTY_API_URL").unwrap_or(default_url),
        }
    }
}

pub struct AnilibriaClient {
    client: Client,
    config: ApiConfig,
}

impl Default for AnilibriaClient {
    fn default() -> Self {
        Self::new()
    }
}

impl AnilibriaClient {
    pub fn new() -> Self {
        Self::with_config(ApiConfig::default())
    }

    pub fn with_config(config: ApiConfig) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Aniplayer/1.0"),
        );
        let client = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client, config }
    }

    pub async fn get_status(&self) -> Result<ApiStatus, String> {
        let url = format!("{}/app/status", self.config.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<ApiStatus>().await.map_err(|e| e.to_string())
    }

    pub async fn get_latest_releases(&self, limit: u32) -> Result<Vec<ReleasePreview>, String> {
        let url = format!(
            "{}/anime/releases/latest?limit={}",
            self.config.base_url, limit
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Vec<ReleasePreview>>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_schedule_week(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/anime/schedule/week", self.config.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_genres(&self) -> Result<Vec<GenreItem>, String> {
        let url = format!("{}/anime/genres", self.config.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Vec<GenreItem>>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_genre_releases(
        &self,
        genre_id: i64,
        page: u32,
        limit: u32,
    ) -> Result<GenreReleasesPage, String> {
        let page = page.max(1);
        let limit = limit.max(1);
        let url = format!(
            "{}/anime/genres/{}/releases?page={}&limit={}",
            self.config.base_url, genre_id, page, limit
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let result = resp
            .json::<GenreReleasesResponse>()
            .await
            .map_err(|e| e.to_string())?;
        Ok(match result {
            GenreReleasesResponse::Wrapped { data, meta } => GenreReleasesPage {
                pagination: meta
                    .and_then(|meta| meta.pagination)
                    .unwrap_or_else(|| GenrePagination::single_page(limit, data.len())),
                releases: data,
            },
            GenreReleasesResponse::Direct(items) => GenreReleasesPage {
                pagination: GenrePagination::single_page(limit, items.len()),
                releases: items,
            },
        })
    }

    pub async fn get_release(&self, id_or_alias: &str) -> Result<ReleaseDetails, String> {
        let url = format!("{}/anime/releases/{}", self.config.base_url, id_or_alias);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<ReleaseDetails>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_release_torrents(&self, release_id: i64) -> Result<Vec<TorrentItem>, String> {
        let url = format!(
            "{}/anime/torrents/release/{}",
            self.config.base_url, release_id
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Vec<TorrentItem>>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_release_franchises(
        &self,
        release_id: i64,
    ) -> Result<Vec<FranchiseItem>, String> {
        let url = format!(
            "{}/anime/franchises/release/{}",
            self.config.base_url, release_id
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Vec<FranchiseItem>>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn search_releases(&self, query: &str) -> Result<Vec<ReleasePreview>, String> {
        let url = format!(
            "{}/app/search/releases?query={}",
            self.config.base_url,
            urlencoding_encode(query)
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Vec<ReleasePreview>>()
            .await
            .map_err(|e| e.to_string())
    }
}

fn urlencoding_encode(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}
