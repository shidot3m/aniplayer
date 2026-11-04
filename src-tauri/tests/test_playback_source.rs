//! The WebView is the only playback backend, so the source it is handed is the one
//! surface where a stored path can reach a file reader. The Rust side still owns that
//! decision: an Episode resolves either to a re-parsed HTTP(S) URL or to a canonical
//! file inside the app's `downloads/` folder, and to nothing else.

use std::fs;

use aniplayer_lib::playback::{resolve_source, ResolvedSource};

/// A scratch app folder with the `downloads/` directory the portable layout defines.
/// The returned path is unique per test process so parallel tests cannot collide.
fn scratch_app_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aniplayer-playback-{name}-{}-{}",
        std::process::id(),
        name
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("downloads")).expect("downloads folder must be creatable");
    dir
}

#[test]
fn an_https_stream_resolves_to_the_url_the_webview_may_load() {
    let dir = scratch_app_dir("remote");
    let resolved = resolve_source(&dir, "https://cache.libria.fun/videos/a/720/x.m3u8?token=1")
        .expect("an HTTPS playlist is a playable source");

    // Re-parsed and re-serialized: the page gets an URL the parser produced, never a
    // substring of whatever the API returned.
    assert_eq!(
        resolved,
        ResolvedSource::Remote {
            value: "https://cache.libria.fun/videos/a/720/x.m3u8?token=1".to_string(),
        }
    );

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_downloaded_playlist_resolves_to_its_canonical_path_inside_the_downloads_folder() {
    let dir = scratch_app_dir("local");
    let episode = dir.join("downloads").join("10303").join("5");
    fs::create_dir_all(&episode).expect("episode folder must be creatable");
    let playlist = episode.join("index.m3u8");
    fs::write(&playlist, "#EXTM3U\n").expect("playlist must be writable");

    // A non-canonical spelling of the same file is what the database may hold: the
    // resolver answers with the canonical path the asset protocol then serves.
    let messy = episode.join(".").join("index.m3u8");
    let resolved = resolve_source(&dir, &messy.to_string_lossy())
        .expect("a downloaded episode is a playable source");

    assert_eq!(
        resolved,
        ResolvedSource::Local {
            value: playlist
                .canonicalize()
                .unwrap()
                .to_string_lossy()
                .to_string(),
        }
    );

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_path_that_climbs_out_of_the_downloads_folder_is_refused() {
    let dir = scratch_app_dir("escape");
    let outside = dir.join("secret.m3u8");
    fs::write(&outside, "#EXTM3U\n").expect("file must be writable");

    let through_symlink_free = dir.join("downloads").join("..").join("secret.m3u8");
    let error = resolve_source(&dir, &through_symlink_free.to_string_lossy())
        .expect_err("a path outside downloads/ is not a playable source");
    assert!(
        error.contains("папки загрузок"),
        "the user must be told where the source is expected: {error}"
    );

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_folder_is_not_a_playable_source() {
    let dir = scratch_app_dir("folder");
    let folder = dir.join("downloads").join("10303");
    fs::create_dir_all(&folder).expect("folder must be creatable");

    let error =
        resolve_source(&dir, &folder.to_string_lossy()).expect_err("a folder cannot be played");
    assert!(
        error.contains("папки загрузок"),
        "a folder is refused as an out-of-folder source: {error}"
    );

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn only_http_https_and_local_files_are_considered_at_all() {
    let dir = scratch_app_dir("schemes");
    for source in [
        "ftp://host/episode.mkv",
        "file:///C:/Windows/system32/cmd.exe",
        "magnet:?xt=urn:btih:0000",
    ] {
        let error = resolve_source(&dir, source).expect_err("{source} is not a playable source");
        assert!(
            error.contains("HTTP(S)"),
            "a non-HTTP scheme must be named as such: {error}"
        );
    }

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn an_empty_source_is_explained_instead_of_loading_nothing() {
    let dir = scratch_app_dir("empty");
    let error = resolve_source(&dir, "").expect_err("nothing to play");
    assert!(
        error.contains("Нет доступного источника"),
        "an empty source must read as a missing Episode source: {error}"
    );
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_missing_downloaded_file_says_the_episode_cannot_be_opened() {
    let dir = scratch_app_dir("missing");
    let gone = dir
        .join("downloads")
        .join("10303")
        .join("5")
        .join("index.m3u8");
    let error = resolve_source(&dir, &gone.to_string_lossy())
        .expect_err("a file that is not on disk cannot be played");
    assert!(
        error.contains("Не удалось открыть скачанный эпизод"),
        "the user must learn the file is gone, not that the folder is wrong: {error}"
    );
    fs::remove_dir_all(&dir).ok();
}
