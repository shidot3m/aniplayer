use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkItem {
    pub release_id: i64,
    pub category: String, // WATCHING, PLANNED, POSTPONED, ABANDONED, NOT_INTERESTED, FAVORITES, WATCHED
    pub release_data_json: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub release_id: i64,
    pub episode_id: String,
    pub episode_ordinal: f64,
    pub last_position: f64,
    pub duration: f64,
    pub is_completed: bool,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedEpisodeMeta {
    pub episode_id: String,
    pub release_id: i64,
    pub episode_ordinal: f64,
    pub file_path: String,
    pub file_size: i64,
    pub quality: String,
    pub opening_start: Option<f64>,
    pub opening_stop: Option<f64>,
    pub ending_start: Option<f64>,
    pub ending_stop: Option<f64>,
    pub download_status: String, // PENDING, DOWNLOADING, COMPLETED, FAILED
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettingItem {
    pub key: String,
    pub value: String,
}
