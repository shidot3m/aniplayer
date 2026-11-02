use std::sync::Arc;

use thiserror::Error;

use crate::api::AnilibriaClient;
use crate::codec::CodecCapabilities;
use crate::db::Database;
use crate::downloader::{EngineInitError, HlsDownloader, TorrentDownloader, TorrentEngine};
use crate::remux::RemuxService;
use crate::state::AppState;

/// A fatal error detected while bringing the application up. The `display`
/// message is written for the end user: what failed, where, and what to do
/// about it.
#[derive(Debug, Error)]
pub enum StartupError {
    #[error("Aniplayer could not open the database at {path}.\n{reason}\nCheck that the folder is writable and the disk is not full. If the file is locked, close the other program using it (a running Aniplayer, a database browser, an antivirus scan) and restart.")]
    Database { path: String, reason: String },

    #[error("Aniplayer could not start the torrent engine.\n{reason}\nAnother instance of Aniplayer or another torrent client may already be using the required network port. Close it and restart Aniplayer.")]
    TorrentEngine { reason: String },

    #[error("Aniplayer could not prepare its torrent folder at {path}.\n{reason}\nCheck folder permissions and available disk space, then restart Aniplayer.")]
    TorrentDataDir { path: String, reason: String },

    #[error("Aniplayer stopped with an internal error.\n{reason}")]
    Run { reason: String },
}

impl From<EngineInitError> for StartupError {
    fn from(error: EngineInitError) -> Self {
        match error {
            EngineInitError::Folder { path, reason } => StartupError::TorrentDataDir {
                path: path.display().to_string(),
                reason,
            },
            EngineInitError::Session { reason } => StartupError::TorrentEngine { reason },
        }
    }
}

/// Opens the persistent database, creating its folder if needed. There is no
/// fallback: a database that cannot be opened is reported to the caller, never
/// silently replaced by an in-memory one, because that would look like data
/// loss on the next start.
pub fn open_database(path: &std::path::Path) -> Result<Database, StartupError> {
    let display = path.display().to_string();
    let context = |reason: String| StartupError::Database {
        path: display.clone(),
        reason,
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| context(format!("could not create the data folder: {e}")))?;
    }
    Database::new(path).map_err(|e| context(e.to_string()))
}

/// Brings up the torrent engine, keeping folder and session failures
/// distinguishable for the user.
pub fn create_torrent_engine(
    app_dir: &std::path::Path,
    db: Arc<Database>,
    codec_caps: Arc<CodecCapabilities>,
) -> Result<TorrentEngine, StartupError> {
    tauri::async_runtime::block_on(TorrentEngine::try_new(
        app_dir.to_path_buf(),
        db,
        codec_caps,
    ))
    .map_err(StartupError::from)
}

/// The directory the application keeps its data in: next to the executable, so
/// the portable archive stays self-contained.
pub fn app_dir() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

/// Builds every managed resource, each fallible step running before anything
/// depends on it, so a failure means nothing half-started is left behind.
pub fn bootstrap() -> Result<AppState, StartupError> {
    let app_dir = app_dir();
    let db_path = app_dir.join("data").join("aniplayer.db");
    let db = Arc::new(open_database(&db_path)?);
    let downloader = Arc::new(HlsDownloader::new(db.clone()));
    let codec_caps = Arc::new(CodecCapabilities::default());
    let torrent_engine = Arc::new(create_torrent_engine(
        &app_dir,
        db.clone(),
        codec_caps.clone(),
    )?);

    Ok(AppState {
        db,
        api: Arc::new(AnilibriaClient::new()),
        downloader,
        torrent_downloader: Arc::new(TorrentDownloader::new()),
        torrent_engine,
        codec_caps,
        remux: Arc::new(RemuxService::new()),
        app_dir,
    })
}

/// Presents a fatal error where the user will actually see it. Startup and
/// shutdown failures happen outside the webview, so a dialog plugin that needs
/// the event loop cannot be used here.
pub fn report(error: &StartupError) {
    eprintln!("Aniplayer failed to start:\n{error}");
    rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Error)
        .set_title("Aniplayer failed to start")
        .set_description(error.to_string())
        .show();
}
