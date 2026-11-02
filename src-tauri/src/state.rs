use std::path::PathBuf;
use std::sync::Arc;

use crate::api::AnilibriaClient;
use crate::db::Database;
use crate::downloader::{HlsDownloader, TorrentDownloader, TorrentEngine};

pub struct AppState {
    pub db: Arc<Database>,
    pub api: Arc<AnilibriaClient>,
    pub downloader: Arc<HlsDownloader>,
    pub torrent_downloader: Arc<TorrentDownloader>,
    pub torrent_engine: Arc<TorrentEngine>,
    pub app_dir: PathBuf,
}
