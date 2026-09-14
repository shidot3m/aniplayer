use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiStatus {
    pub is_alive: bool,
    pub available_api_endpoints: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReleaseName {
    pub main: String,
    pub english: Option<String>,
    pub alternative: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReleaseType {
    pub value: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImageSource {
    pub src: Option<String>,
    pub preview: Option<String>,
    pub thumbnail: Option<String>,
    pub optimized: Option<ImageOptimized>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImageOptimized {
    pub src: Option<String>,
    pub preview: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipTimecode {
    pub start: Option<f64>,
    pub stop: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodeItem {
    pub id: String,
    pub name: Option<String>,
    pub ordinal: f64,
    pub duration: Option<f64>,
    pub preview: Option<ImageSource>,
    pub hls_480: Option<String>,
    pub hls_720: Option<String>,
    pub hls_1080: Option<String>,
    pub opening: Option<SkipTimecode>,
    pub ending: Option<SkipTimecode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenreItem {
    pub id: i64,
    pub name: String,
    pub image: Option<ImageSource>,
    pub total_releases: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleasePreview {
    pub id: i64,
    pub name: ReleaseName,
    #[serde(rename = "type")]
    pub release_type: Option<ReleaseType>,
    pub year: Option<i64>,
    pub episodes_total: Option<i64>,
    pub poster: Option<ImageSource>,
    pub description: Option<String>,
    pub is_ongoing: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseDetails {
    pub id: i64,
    pub name: ReleaseName,
    #[serde(rename = "type")]
    pub release_type: Option<ReleaseType>,
    pub year: Option<i64>,
    pub episodes_total: Option<i64>,
    pub average_duration_of_episode: Option<f64>,
    pub poster: Option<ImageSource>,
    pub description: Option<String>,
    pub is_ongoing: Option<bool>,
    pub genres: Option<Vec<GenreItem>>,
    #[serde(default)]
    pub episodes: Vec<EpisodeItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentCodec {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentItem {
    pub id: i64,
    pub hash: String,
    pub size: Option<i64>,
    pub label: Option<String>,
    pub codec: Option<TorrentCodec>,
    pub filename: Option<String>,
    pub seeders: Option<i64>,
    pub leechers: Option<i64>,
    pub magnet: Option<String>,
}
