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
    pub genres: Option<Vec<GenreItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenrePagination {
    #[serde(default)]
    pub total: i64,
    #[serde(default)]
    pub count: i64,
    #[serde(default)]
    pub per_page: i64,
    #[serde(default = "default_page")]
    pub current_page: i64,
    #[serde(default = "default_page")]
    pub total_pages: i64,
}

impl GenrePagination {
    pub(crate) fn single_page(per_page: u32, count: usize) -> Self {
        Self {
            total: count as i64,
            count: count as i64,
            per_page: per_page as i64,
            current_page: 1,
            total_pages: 1,
        }
    }
}

fn default_page() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenreReleasesPage {
    pub releases: Vec<ReleasePreview>,
    pub pagination: GenrePagination,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum GenreReleasesResponse {
    Wrapped {
        data: Vec<ReleasePreview>,
        meta: Option<GenreReleasesMeta>,
    },
    Direct(Vec<ReleasePreview>),
}

#[derive(Debug, Clone, Deserialize)]
pub struct GenreReleasesMeta {
    pub pagination: Option<GenrePagination>,
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
pub struct FranchiseReleaseItem {
    pub id: Option<String>,
    pub sort_order: Option<i64>,
    pub release_id: Option<i64>,
    pub release: Option<ReleasePreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FranchiseItem {
    pub id: Option<String>,
    pub name: Option<String>,
    pub name_english: Option<String>,
    pub total_releases: Option<i64>,
    pub franchise_releases: Option<Vec<FranchiseReleaseItem>>,
}
