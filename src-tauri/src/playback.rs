//! The one place a playback source is accepted.
//!
//! The WebView plays what it is handed, so the source string is the only spot where a value
//! from the API or from the downloaded-episode index can reach a file reader. It stays guarded
//! here, in Rust: an Episode resolves either to a re-parsed HTTP(S) URL or to an asset-protocol
//! URL for a canonical file inside the app's `downloads/` folder, and to nothing else.

use std::path::Path;

use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};

/// The origin WebView2 serves the asset protocol from. `useHttpsScheme` is off in
/// `tauri.conf.json`, and `test_security_config.rs` guards that, because this literal has to
/// agree with the URL the page is allowed to load.
const ASSET_ORIGIN: &str = "http://asset.localhost";

/// JavaScript's `encodeURIComponent`, which is also the set Tauri's own `convertFileSrc` uses.
const ENCODE_URI_COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

/// The asset URL of a file inside the downloads folder, with one path segment per directory.
///
/// `convertFileSrc` escapes an entire path into a single segment. That is right for a file the
/// page names directly and wrong for an Offline playlist, whose segment, init and key URIs are
/// bare filenames: hls.js resolves them against the playlist's directory, so a URL without one
/// would ask the asset origin for `/segment-00001.ts` — outside the scope, and every part of
/// the download after the playlist itself would fail.
fn asset_url(path: &Path) -> String {
    let plain = dunce::simplified(path).to_string_lossy().to_string();
    let encoded = plain
        .split(['/', '\\'])
        .filter(|part| !part.is_empty())
        .map(|part| utf8_percent_encode(part, ENCODE_URI_COMPONENT).to_string())
        .collect::<Vec<_>>()
        .join("/");
    format!("{ASSET_ORIGIN}/{encoded}")
}

/// A source is a path when it is spelled as one on Windows: a drive prefix (`C:\`, `C:/`) or a
/// UNC prefix (`\\server\share`), or it carries no colon at all. Everything else is read as a
/// scheme, which covers every stream URL the API hands out. The drive prefix is checked before
/// the colon rule because `c:` alone is a valid URL scheme.
fn is_path(source: &str) -> bool {
    if source.starts_with(r"\\") {
        return true;
    }
    let bytes = source.as_bytes();
    let drive_prefixed = bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/');
    drive_prefixed || !source.contains(':')
}

/// The URL the media element may be pointed at, or the reason it may not — written for the
/// person watching the frame, because the overlay shows this text.
pub fn resolve_source(app_dir: &Path, source: &str) -> Result<String, String> {
    if source.is_empty() {
        return Err("Нет доступного источника для этого эпизода".to_string());
    }
    if !is_path(source) {
        let url =
            reqwest::Url::parse(source).map_err(|e| format!("Некорректный адрес потока: {e}"))?;
        return match url.scheme() {
            "http" | "https" => Ok(url.to_string()),
            other => Err(format!(
                "Воспроизвести можно только HTTP(S)-поток или скачанный эпизод, а не схему {other}"
            )),
        };
    }
    // A relative name would canonicalize against the process's working directory, which is
    // not the app's folder; resolve it where the user means it.
    let candidate = if Path::new(source).is_relative() {
        app_dir.join(source)
    } else {
        Path::new(source).to_path_buf()
    };
    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("Не удалось открыть скачанный эпизод: {e}"))?;
    let downloads = app_dir
        .join("downloads")
        .canonicalize()
        .map_err(|e| format!("Папка загрузок недоступна: {e}"))?;
    if !canonical.starts_with(&downloads) || !canonical.is_file() {
        return Err("Скачанный эпизод должен лежать внутри папки загрузок".to_string());
    }
    Ok(asset_url(&canonical))
}
