use aniplayer_lib::db::Database;
use aniplayer_lib::downloader::scanner::{
    extract_episode_ordinal, find_unsupported_videos, is_playable_in_webview,
    scan_and_index_torrent_files, scan_unsupported_torrent_files,
};
use std::fs;
use std::path::{Path, PathBuf};

fn temp_folder(name: &str) -> PathBuf {
    let folder =
        std::env::temp_dir().join(format!("aniplayer-scanner-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&folder);
    fs::create_dir_all(&folder).expect("temp folder must be creatable");
    folder
}

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("parent folder must be creatable");
    }
    fs::write(path, bytes).expect("test file must be writable");
}

#[test]
fn test_extract_episode_ordinal() {
    assert_eq!(
        extract_episode_ordinal("[Anilibria] Hell Mode - 01 [1080p].mkv"),
        Some(1.0)
    );
    assert_eq!(
        extract_episode_ordinal("Jujutsu_Kaisen_S2_E04.mp4"),
        Some(4.0)
    );
    assert_eq!(extract_episode_ordinal("Title_ep12.mkv"), Some(12.0));
    assert_eq!(extract_episode_ordinal("Серия 03.mkv"), Some(3.0));
    assert_eq!(extract_episode_ordinal("Episode 24 [HEVC].mkv"), Some(24.0));
    assert_eq!(extract_episode_ordinal("05.mp4"), Some(5.0));
    assert_eq!(
        extract_episode_ordinal("Attack_on_Titan_Part_3_Ep_08.mkv"),
        Some(8.0)
    );
    assert_eq!(extract_episode_ordinal("random_file.txt"), None);
}

#[test]
fn only_mp4_and_webm_are_playable_in_the_webview() {
    assert!(is_playable_in_webview("01.mp4"));
    assert!(is_playable_in_webview("01.WEBM"));
    assert!(!is_playable_in_webview("01.mkv"));
    assert!(!is_playable_in_webview("01.avi"));
    assert!(!is_playable_in_webview("01.ts"));
    assert!(!is_playable_in_webview("readme.txt"));
}

#[test]
fn torrent_scan_indexes_only_webview_playable_containers() {
    let folder = temp_folder("index");
    write_file(&folder.join("01.mp4"), b"mp4");
    write_file(&folder.join("Season 1/02.mkv"), b"mkv");
    write_file(&folder.join("extras/03.webm"), b"webm");
    write_file(&folder.join("notes.txt"), b"notes");

    let db = Database::init_in_memory().expect("in-memory database must open");
    let indexed = scan_and_index_torrent_files(&folder, 42, &db).expect("scan must succeed");

    assert_eq!(indexed, 2);
    let mut ordinals: Vec<f64> = db
        .get_all_downloaded_episodes()
        .expect("episodes must be readable")
        .into_iter()
        .map(|episode| episode.episode_ordinal)
        .collect();
    ordinals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    assert_eq!(ordinals, vec![1.0, 3.0]);

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn unsupported_report_lists_files_the_webview_cannot_play() {
    let folder = temp_folder("unsupported");
    write_file(&folder.join("01.mp4"), b"mp4");
    write_file(&folder.join("Season 1/02.mkv"), b"mkv-bytes");
    write_file(&folder.join("Season 1/03.avi"), b"avi");

    let report = find_unsupported_videos(&folder);

    let names: Vec<&str> = report.iter().map(|file| file.file_name.as_str()).collect();
    assert_eq!(names, vec!["02.mkv", "03.avi"]);
    assert_eq!(report[0].file_size, 9);

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn unsupported_report_groups_files_by_release_folder() {
    let torrents_root = temp_folder("releases");
    write_file(&torrents_root.join("42/02.mkv"), b"mkv");
    write_file(&torrents_root.join("42/01.mp4"), b"mp4");
    write_file(&torrents_root.join("77/05.avi"), b"avi");
    write_file(&torrents_root.join("not-a-release/ignored.mkv"), b"mkv");

    let report = scan_unsupported_torrent_files(&torrents_root);

    let entries: Vec<(i64, &str)> = report
        .iter()
        .map(|file| (file.release_id, file.file_name.as_str()))
        .collect();
    assert_eq!(entries, vec![(42, "02.mkv"), (77, "05.avi")]);

    let _ = fs::remove_dir_all(&torrents_root);
}
