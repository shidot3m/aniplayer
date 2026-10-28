//! Startup failure policy: the persistent database is the only database, and a
//! startup dependency that cannot be created produces an actionable error
//! instead of a silent fallback or a panic.
//!
//! The seams under test are `aniplayer_lib::startup::open_database` and
//! `aniplayer_lib::startup::create_torrent_engine` — the same calls `run()`
//! performs before the app accepts control.

use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};

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

#[test]
fn torrent_engine_failure_is_a_returned_error_instead_of_a_panic() {
    let dir = unique_temp_dir("torrentfail");
    let db = Arc::new(Database::init_in_memory().expect("in-memory database for the engine test"));

    // The torrents folder cannot be created underneath a regular file, the way
    // it cannot on a read-only or full disk.
    let blocker = dir.join("blocking-file");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(&blocker, b"x").unwrap();
    let unusable_base = blocker.join("app");

    let message = match startup::create_torrent_engine(&unusable_base, db) {
        Ok(_) => panic!("the engine must not report success when its folder cannot be created"),
        Err(err) => err.to_string(),
    };

    let lowered = message.to_lowercase();
    assert!(
        lowered.contains("torrent"),
        "the error must identify the failing subsystem, got: {lowered}"
    );
    assert!(
        lowered.contains(&unusable_base.display().to_string().to_lowercase()),
        "the error must name the folder the engine could not use, got: {lowered}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}
