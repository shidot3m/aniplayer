use std::sync::Arc;

use thiserror::Error;

use crate::api::AnilibriaClient;
use crate::db::Database;
use crate::downloader::HlsDownloader;
use crate::state::AppState;

/// A fatal error detected while bringing the application up. The `display`
/// message is written for the end user: what failed, where, and what to do
/// about it.
#[derive(Debug, Error)]
pub enum StartupError {
    #[error("Aniplayer could not open the database at {path}.\n{reason}\nCheck that the folder is writable and the disk is not full. If the file is locked, close the other program using it (a running Aniplayer, a database browser, an antivirus scan) and restart.")]
    Database { path: String, reason: String },

    #[error("Aniplayer could not clear the downloads an older version left in its library.\n{reason}\nCheck that the database file is writable and the disk is not full, then restart Aniplayer.")]
    LegacyCleanup { reason: String },

    #[error("Aniplayer could not reconcile the downloads a previous run left unfinished.\n{reason}\nCheck that the database file is writable and the disk is not full, then restart Aniplayer.")]
    InterruptedDownloads { reason: String },

    #[error("Aniplayer stopped with an internal error.\n{reason}")]
    Run { reason: String },
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

/// The id prefix the retired torrent scanner wrote its Downloaded episode rows
/// under. Nothing produces those rows any more and nothing can play them, so
/// they leave the library index at startup. The media files beside them are the
/// user's property and are never touched.
const LEGACY_TORRENT_ID_PREFIX: &str = "torrent-";

/// Drops the Downloaded episodes an older build indexed from torrent payloads.
/// Runs on every startup: it is one `DELETE` and stays correct after the rows
/// are gone, so it needs no version marker of its own.
pub fn purge_legacy_torrent_downloads(db: &Database) -> Result<usize, StartupError> {
    db.delete_downloaded_episodes_with_id_prefix(LEGACY_TORRENT_ID_PREFIX)
        .map_err(|e| StartupError::LegacyCleanup {
            reason: e.to_string(),
        })
}

/// Reconciles the HLS downloads a previous process died in the middle of.
///
/// A `DOWNLOADING` row is written when a task starts and is only left behind when the task is
/// killed with its process — closing the window, a restart, `Stop-Process`. Nothing owns the row
/// on the next launch: it would sit in the library as a `0 Б` episode that is neither playable
/// (no playlist) nor resumable, and its segments would be orphaned on disk. The pass moves every
/// such row to `FAILED` so it reads as an unfinished download the library offers to download
/// again, and it leaves the already-downloaded bytes on disk untouched (issue #78).
///
/// Runs on every startup: it is one `UPDATE` filtered by status, so it stays correct after the
/// rows are reconciled and needs no version marker. At startup no live task exists, so there is
/// no in-flight `DOWNLOADING` row to disturb.
pub fn reconcile_interrupted_downloads(db: &Database) -> Result<usize, StartupError> {
    db.mark_downloading_failed()
        .map_err(|e| StartupError::InterruptedDownloads {
            reason: e.to_string(),
        })
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
    purge_legacy_torrent_downloads(&db)?;
    reconcile_interrupted_downloads(&db)?;

    Ok(AppState {
        db: db.clone(),
        api: Arc::new(AnilibriaClient::new()),
        downloader: Arc::new(HlsDownloader::new(db)),
        app_dir: app_dir.clone(),
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
