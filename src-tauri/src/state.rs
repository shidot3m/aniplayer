use std::path::PathBuf;
use std::sync::Arc;

use crate::api::AnilibriaClient;
use crate::db::Database;
use crate::downloader::HlsDownloader;

pub struct AppState {
    pub db: Arc<Database>,
    pub api: Arc<AnilibriaClient>,
    pub downloader: Arc<HlsDownloader>,
    pub app_dir: PathBuf,
}
