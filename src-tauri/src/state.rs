use std::path::PathBuf;
use std::sync::Arc;

use crate::api::AnilibriaClient;
use crate::codec::CodecCapabilities;
use crate::db::Database;
use crate::downloader::{HlsDownloader, TorrentDownloader, TorrentEngine};
use crate::remux::RemuxService;

pub struct AppState {
    pub db: Arc<Database>,
    pub api: Arc<AnilibriaClient>,
    pub downloader: Arc<HlsDownloader>,
    pub torrent_downloader: Arc<TorrentDownloader>,
    pub torrent_engine: Arc<TorrentEngine>,
    /// What this WebView said it can decode, once the startup probe has answered.
    pub codec_caps: Arc<CodecCapabilities>,
    /// Streams prepared for playback, served by the remux protocol.
    pub remux: Arc<RemuxService>,
    pub app_dir: PathBuf,
}
