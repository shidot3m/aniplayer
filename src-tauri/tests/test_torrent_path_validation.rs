use aniplayer_lib::downloader::torrent::validate_torrent_path;
use std::fs;
use std::path::PathBuf;

fn case_dir(tag: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "aniplayer_torrent_path_{tag}_{}",
        std::process::id()
    ))
}

fn temp_root(tag: &str) -> PathBuf {
    let root = case_dir(tag).join("downloads").join("torrents");
    fs::create_dir_all(&root).unwrap();
    root
}

#[test]
fn test_validate_torrent_path_accepts_existing_file_in_downloads_root() {
    let root = temp_root("accept");
    let file = root.join("anime-01.torrent");
    fs::write(&file, b"d8:announce").unwrap();

    let result = validate_torrent_path(&file, &root);
    assert_eq!(result.unwrap(), file.canonicalize().unwrap());

    fs::remove_dir_all(case_dir("accept")).unwrap();
}

#[test]
fn test_validate_torrent_path_rejects_traversal_outside_root() {
    let base = case_dir("traversal");
    let root = base.join("downloads").join("torrents");
    fs::create_dir_all(&root).unwrap();
    let outside = base.join("evil.torrent");
    fs::write(&outside, b"d8:announce").unwrap();

    let escaping = root.join("..").join("..").join("evil.torrent");
    assert!(validate_torrent_path(&escaping, &root).is_err());

    fs::remove_dir_all(base).unwrap();
}

#[test]
fn test_validate_torrent_path_rejects_foreign_location() {
    let root = temp_root("foreign");
    let other = case_dir("other").join("x.torrent");
    fs::create_dir_all(other.parent().unwrap()).unwrap();
    fs::write(&other, b"d8:announce").unwrap();

    assert!(validate_torrent_path(&other, &root).is_err());

    fs::remove_dir_all(case_dir("foreign")).unwrap();
    fs::remove_dir_all(case_dir("other")).unwrap();
}

#[test]
fn test_validate_torrent_path_rejects_missing_file() {
    let root = temp_root("missing");
    let ghost = root.join("ghost.torrent");
    assert!(validate_torrent_path(&ghost, &root).is_err());

    fs::remove_dir_all(case_dir("missing")).unwrap();
}
