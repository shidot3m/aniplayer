//! Startup failure policy: the persistent database is the only database, and a
//! startup dependency that cannot be created produces an actionable error
//! instead of a silent fallback or a panic.
//!
//! The seams under test are `aniplayer_lib::startup::open_database` and
//! `aniplayer_lib::startup::purge_legacy_torrent_downloads` — the same calls
//! `run()` performs before the app accepts control.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use aniplayer_lib::db::{
    models::{BookmarkItem, DownloadedEpisodeMeta, HistoryItem},
    Database,
};
use aniplayer_lib::startup;

fn unique_temp_dir(label: &str) -> PathBuf {
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "aniplayer-startup-{label}-{}-{id}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn downloaded(
    episode_id: &str,
    release_id: i64,
    ordinal: f64,
    file_path: &str,
) -> DownloadedEpisodeMeta {
    DownloadedEpisodeMeta {
        episode_id: episode_id.to_string(),
        release_id,
        episode_ordinal: ordinal,
        file_path: file_path.to_string(),
        file_size: 350_000_000,
        quality: "1080p".to_string(),
        opening_start: Some(23.0),
        opening_stop: Some(113.0),
        ending_start: None,
        ending_stop: None,
        download_status: "COMPLETED".to_string(),
    }
}

fn bookmark(release_id: i64) -> BookmarkItem {
    BookmarkItem {
        release_id,
        category: "WATCHING".to_string(),
        release_data_json: "{}".to_string(),
        updated_at: None,
    }
}

// Manual check for the dialog half of the behavior (not automatable headless):
// make `<exe dir>\data\aniplayer.db` unopenable (e.g. replace it with a
// directory of the same name), start the app, and confirm Aniplayer shows a
// native "could not open the database at <path>" error with actionable hints
// and exits, instead of starting with an empty in-memory database.
#[test]
fn database_survives_application_restart() {
    let dir = unique_temp_dir("persist");
    let db_path = dir.join("data").join("aniplayer.db");

    let db = startup::open_database(&db_path).expect("database must open at a writable path");
    assert!(
        db_path.is_file(),
        "the database must be a file on disk, not an in-memory stand-in"
    );
    db.save_bookmark(&bookmark(42)).expect("save bookmark");
    db.save_history(&HistoryItem {
        release_id: 42,
        episode_id: "ep-1".to_string(),
        episode_ordinal: 1.0,
        last_position: 520.0,
        duration: 1420.0,
        is_completed: false,
        updated_at: None,
    })
    .expect("save history");
    db.save_downloaded_episode(&DownloadedEpisodeMeta {
        episode_id: "ep-1".to_string(),
        release_id: 42,
        episode_ordinal: 1.0,
        file_path: "downloads/42/1.mp4".to_string(),
        file_size: 350_000_000,
        quality: "1080p".to_string(),
        opening_start: Some(23.0),
        opening_stop: Some(113.0),
        ending_start: None,
        ending_stop: None,
        download_status: "COMPLETED".to_string(),
    })
    .expect("save downloaded episode");
    drop(db);

    let db = startup::open_database(&db_path).expect("database must reopen after restart");
    let restored = db.get_bookmarks(None).expect("read bookmarks");
    assert_eq!(
        restored.iter().map(|b| b.release_id).collect::<Vec<_>>(),
        vec![42],
        "a restart must see the previously persisted bookmark"
    );

    let history = db.get_continue_watching().expect("read history");
    assert_eq!(history.len(), 1, "a restart must see the persisted history");
    assert_eq!(history[0].last_position, 520.0);

    let downloaded = db
        .get_downloaded_episode("ep-1")
        .expect("read downloaded episode")
        .expect("a restart must see the persisted download metadata");
    assert_eq!(downloaded.file_path, "downloads/42/1.mp4");
    assert_eq!(downloaded.opening_start, Some(23.0));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn database_open_failure_is_an_actionable_error_naming_the_path() {
    let dir = unique_temp_dir("dbfail");
    let blocking_file = dir.join("data").join("blocking-file");
    std::fs::create_dir_all(blocking_file.parent().unwrap()).unwrap();
    std::fs::write(&blocking_file, b"x").unwrap();
    let bogus_path = blocking_file.join("aniplayer.db");

    let err = match startup::open_database(&bogus_path) {
        Ok(_) => panic!("opening a database under a file path must fail, not fall back"),
        Err(err) => err,
    };

    let message = err.to_string();
    assert!(
        message.contains(&bogus_path.display().to_string()),
        "the error must name the database path so the user can act on it, got: {message}"
    );
    let lowered = message.to_lowercase();
    assert!(
        lowered.contains("permission")
            || lowered.contains("disk space")
            || lowered.contains("lock"),
        "the error must suggest actionable causes, got: {message}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn existing_but_unusable_database_file_is_reported_not_replaced() {
    let dir = unique_temp_dir("dbcorrupt");
    let db_path = dir.join("data").join("aniplayer.db");
    std::fs::create_dir_all(db_path.parent().unwrap()).unwrap();
    // Not SQLite: opening must fail instead of the app quietly starting over.
    std::fs::write(&db_path, b"not a database").unwrap();

    let message = match startup::open_database(&db_path) {
        Ok(_) => panic!("an unreadable database file must not be replaced by a fresh one"),
        Err(err) => err.to_string(),
    };

    assert!(
        message.contains(&db_path.display().to_string()),
        "the error must name the database path, got: {message}"
    );
    assert!(
        std::fs::read(&db_path).unwrap() == b"not a database",
        "a failed open must leave the existing file untouched"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

/// The Downloaded episode ids the index holds, in release/ordinal order.
fn downloaded_ids(db: &Database) -> Vec<String> {
    db.get_all_downloaded_episodes()
        .expect("read downloaded episodes")
        .into_iter()
        .map(|item| item.episode_id)
        .collect()
}

#[test]
fn startup_purge_drops_legacy_torrent_rows_and_keeps_everything_else() {
    let dir = unique_temp_dir("torrentpurge");
    let db_path = dir.join("data").join("aniplayer.db");
    let db = startup::open_database(&db_path).expect("database must open at a writable path");

    // Legacy inheritance: the torrent scanner indexed payload files under
    // `downloads/torrents/<release_id>/` as `torrent-<release_id>-<ordinal>`.
    let torrent_dir = dir.join("downloads").join("torrents").join("42");
    std::fs::create_dir_all(&torrent_dir).unwrap();
    std::fs::write(torrent_dir.join("ep01.mkv"), b"mkv payload").unwrap();
    std::fs::write(torrent_dir.join("ep02.mkv"), b"mkv payload").unwrap();

    // An HLS download keeps its own folder with the offline playlist.
    let hls_dir = dir.join("downloads").join("42").join("1");
    std::fs::create_dir_all(&hls_dir).unwrap();
    std::fs::write(hls_dir.join("index.m3u8"), b"#EXTM3U").unwrap();

    db.save_downloaded_episode(&downloaded(
        "torrent-42-1",
        42,
        1.0,
        &torrent_dir.join("ep01.mkv").to_string_lossy(),
    ))
    .expect("seed torrent row");
    db.save_downloaded_episode(&downloaded(
        "torrent-42-2",
        42,
        2.0,
        &torrent_dir.join("ep02.mkv").to_string_lossy(),
    ))
    .expect("seed torrent row");
    db.save_downloaded_episode(&downloaded(
        "ep-100",
        42,
        1.0,
        &hls_dir.join("index.m3u8").to_string_lossy(),
    ))
    .expect("seed hls row");
    db.save_bookmark(&bookmark(42)).expect("seed bookmark");
    db.save_history(&HistoryItem {
        release_id: 42,
        episode_id: "ep-100".to_string(),
        episode_ordinal: 1.0,
        last_position: 520.0,
        duration: 1420.0,
        is_completed: false,
        updated_at: None,
    })
    .expect("seed history");

    assert_eq!(
        startup::purge_legacy_torrent_downloads(&db).expect("purge must report success"),
        2,
        "both legacy torrent rows must leave the index"
    );

    assert_eq!(
        downloaded_ids(&db),
        vec!["ep-100"],
        "only the legacy rows may leave; the HLS Download stays indexed"
    );
    assert!(
        hls_dir.join("index.m3u8").is_file(),
        "the downloaded HLS episode folder must stay on disk"
    );
    assert!(
        torrent_dir.join("ep01.mkv").is_file() && torrent_dir.join("ep02.mkv").is_file(),
        "the user's own media files are never the app's to delete"
    );
    assert_eq!(
        db.get_bookmarks(None)
            .expect("read bookmarks")
            .iter()
            .map(|b| b.release_id)
            .collect::<Vec<_>>(),
        vec![42],
        "purging the download index must not touch other tables"
    );
    assert_eq!(
        db.get_continue_watching().expect("read history").len(),
        1,
        "purging the download index must not touch other tables"
    );

    // A second launch of the same build against the same database.
    drop(db);
    let db = startup::open_database(&db_path).expect("database must reopen after restart");
    assert_eq!(
        startup::purge_legacy_torrent_downloads(&db).expect("purge is repeatable"),
        0,
        "a database already cleaned must not report a second purge"
    );
    assert_eq!(
        downloaded_ids(&db),
        vec!["ep-100"],
        "the restart must leave the HLS Download where the first launch put it"
    );
    assert!(
        torrent_dir.join("ep01.mkv").is_file() && hls_dir.join("index.m3u8").is_file(),
        "the second launch must still delete nothing from disk"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn startup_purge_leaves_an_untouched_index_alone() {
    let dir = unique_temp_dir("torrentpurge-noop");
    let db = startup::open_database(&dir.join("data").join("aniplayer.db"))
        .expect("database must open at a writable path");

    db.save_downloaded_episode(&downloaded("ep-1", 7, 1.0, "downloads/7/1/index.m3u8"))
        .expect("seed hls row");

    assert_eq!(
        startup::purge_legacy_torrent_downloads(&db).expect("purge must report success"),
        0,
        "a library with no legacy rows is not rewritten"
    );
    assert_eq!(downloaded_ids(&db), vec!["ep-1"]);

    let _ = std::fs::remove_dir_all(&dir);
}

/// A Downloaded row with an explicit status: the reconcile pass must key off this, not off the
/// size, so the test sets it directly rather than through a completed download.
fn row_with_status(
    episode_id: &str,
    release_id: i64,
    ordinal: f64,
    file_path: &str,
    status: &str,
    file_size: i64,
) -> DownloadedEpisodeMeta {
    DownloadedEpisodeMeta {
        episode_id: episode_id.to_string(),
        release_id,
        episode_ordinal: ordinal,
        file_path: file_path.to_string(),
        file_size,
        quality: "1080p".to_string(),
        opening_start: Some(23.0),
        opening_stop: Some(113.0),
        ending_start: None,
        ending_stop: None,
        download_status: status.to_string(),
    }
}

fn status_of(db: &Database, episode_id: &str) -> String {
    db.get_downloaded_episode(episode_id)
        .expect("read downloaded episode")
        .unwrap_or_else(|| panic!("row {episode_id} must still be indexed"))
        .download_status
}

/// Issue #78: an HLS download interrupted by the death of the process leaves a `DOWNLOADING`
/// row with no playlist and orphan segments on disk. On the next start there is no live task to
/// finish it, so the pass must stop the row reading as a playable download (move it to `FAILED`)
/// while leaving the user's already-downloaded bytes where they are.
#[test]
fn startup_marks_interrupted_downloads_failed_without_touching_their_bytes() {
    let dir = unique_temp_dir("interrupted");
    let db = startup::open_database(&dir.join("data").join("aniplayer.db"))
        .expect("database must open at a writable path");

    // The orphaned folder a killed download leaves behind: segments, no playlist.
    let episode_dir = dir.join("downloads").join("42").join("1");
    std::fs::create_dir_all(&episode_dir).unwrap();
    std::fs::write(episode_dir.join("segment-00000.ts"), b"partial segment").unwrap();
    std::fs::write(episode_dir.join("segment-00001.ts"), b"partial segment").unwrap();

    db.save_downloaded_episode(&row_with_status(
        "ep-int",
        42,
        1.0,
        &episode_dir.join("index.m3u8").to_string_lossy(),
        "DOWNLOADING",
        0,
    ))
    .expect("seed interrupted row");
    // Rows that are already in a terminal state must not be rewritten.
    db.save_downloaded_episode(&row_with_status(
        "ep-done",
        42,
        2.0,
        "downloads/42/2/index.m3u8",
        "COMPLETED",
        300_000_000,
    ))
    .expect("seed completed row");
    db.save_downloaded_episode(&row_with_status(
        "ep-fail",
        42,
        3.0,
        "downloads/42/3/index.m3u8",
        "FAILED",
        0,
    ))
    .expect("seed failed row");

    assert_eq!(
        startup::reconcile_interrupted_downloads(&db).expect("reconcile must report success"),
        1,
        "only the interrupted DOWNLOADING row is reconciled"
    );

    assert_eq!(
        status_of(&db, "ep-int"),
        "FAILED",
        "the interrupted row stops reading as a live download"
    );
    assert_eq!(
        status_of(&db, "ep-done"),
        "COMPLETED",
        "a completed row is left alone"
    );
    assert_eq!(
        status_of(&db, "ep-fail"),
        "FAILED",
        "an already-failed row is left alone"
    );

    assert!(
        episode_dir.join("segment-00000.ts").is_file()
            && episode_dir.join("segment-00001.ts").is_file(),
        "the user's already-downloaded bytes are never the reconcile pass's to delete"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

/// The pass runs on every startup: with nothing interrupted it changes no rows, and a second run
/// after the first reconciled them reports zero again.
#[test]
fn startup_reconcile_is_idempotent_and_quiet_on_a_clean_library() {
    let dir = unique_temp_dir("interrupted-noop");
    let db = startup::open_database(&dir.join("data").join("aniplayer.db"))
        .expect("database must open at a writable path");

    db.save_downloaded_episode(&row_with_status(
        "ep-1",
        7,
        1.0,
        "downloads/7/1/index.m3u8",
        "COMPLETED",
        100,
    ))
    .expect("seed completed row");

    assert_eq!(
        startup::reconcile_interrupted_downloads(&db).expect("clean library is quiet"),
        0,
        "a library with no interrupted rows is not rewritten"
    );

    db.save_downloaded_episode(&row_with_status(
        "ep-2",
        7,
        2.0,
        "downloads/7/2/index.m3u8",
        "DOWNLOADING",
        0,
    ))
    .expect("seed interrupted row");
    assert_eq!(
        startup::reconcile_interrupted_downloads(&db).expect("first reconcile"),
        1,
        "one interrupted row is reconciled"
    );
    assert_eq!(
        startup::reconcile_interrupted_downloads(&db).expect("second reconcile is repeatable"),
        0,
        "the pass changes nothing the second time"
    );

    let _ = std::fs::remove_dir_all(&dir);
}
