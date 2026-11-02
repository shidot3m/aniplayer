use aniplayer_lib::db::Database;
use aniplayer_lib::downloader::scanner::{extract_episode_ordinal, scan_and_index_torrent_files};
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
fn torrent_scan_indexes_every_recognized_video_without_codec_gates() {
    let folder = temp_folder("index");
    write_file(&folder.join("01.hevc.mkv"), b"mpv decodes the payload");
    write_file(&folder.join("Season 1/02.av1.webm"), b"not inspected by the scanner");
    write_file(&folder.join("extras/03.m2ts"), b"mpeg transport stream");
    write_file(&folder.join("notes.txt"), b"notes");

    let db = Database::init_in_memory().expect("in-memory database must open");
    let indexed = scan_and_index_torrent_files(&folder, 42, &db).expect("scan must succeed");

    assert_eq!(indexed, 3);
    let mut paths: Vec<String> = db
        .get_all_downloaded_episodes()
        .expect("episodes must be readable")
        .into_iter()
        .map(|episode| episode.file_path)
        .collect();
    paths.sort();
    assert!(paths.iter().any(|path| path.ends_with("01.hevc.mkv")));
    assert!(paths.iter().any(|path| path.ends_with("02.av1.webm")));
    assert!(paths.iter().any(|path| path.ends_with("03.m2ts")));

    let _ = fs::remove_dir_all(&folder);
}
