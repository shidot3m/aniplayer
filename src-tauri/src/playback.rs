//! The one place a playback source is accepted.
//!
//! The WebView plays what it is handed, so the source string is the only spot where a
//! value from the API or from the downloaded-episode index can reach a file reader. It
//! stays guarded here, in Rust: an Episode resolves either to a re-parsed HTTP(S) URL or
//! to a canonical file inside the app's `downloads/` folder, and to nothing else.

use std::path::Path;

use serde::Serialize;

/// What the media element may be pointed at.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum ResolvedSource {
    /// A stream URL, re-serialized by the URL parser rather than passed through.
    Remote { value: String },
    /// A canonical local file inside the downloads folder, served over the asset protocol.
    Local { value: String },
}

/// A source is a path when it is spelled as one on Windows: a drive prefix (`C:\`, `C:/`)
/// or a UNC prefix (`\\server\share`), or it carries no colon at all. Everything else is
/// read as a scheme, which covers every stream URL the API hands out. The drive prefix is
/// checked before the colon rule because `c:` alone is a valid URL scheme.
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

pub fn resolve_source(app_dir: &Path, source: &str) -> Result<ResolvedSource, String> {
    if source.is_empty() {
        return Err("Нет доступного источника для этого эпизода".to_string());
    }
    if !is_path(source) {
        let url =
            reqwest::Url::parse(source).map_err(|e| format!("Некорректный адрес потока: {e}"))?;
        return match url.scheme() {
            "http" | "https" => Ok(ResolvedSource::Remote {
                value: url.to_string(),
            }),
            other => Err(format!(
                "Воспроизвести можно только HTTP(S)-поток или скачанный эпизод, а не схему {other}"
            )),
        };
    }
    let canonical = Path::new(source)
        .canonicalize()
        .map_err(|e| format!("Не удалось открыть скачанный эпизод: {e}"))?;
    let downloads = app_dir
        .join("downloads")
        .canonicalize()
        .map_err(|e| format!("Папка загрузок недоступна: {e}"))?;
    if !canonical.starts_with(&downloads) || !canonical.is_file() {
        return Err("Скачанный эпизод должен лежать внутри папки загрузок".to_string());
    }
    Ok(ResolvedSource::Local {
        value: canonical.to_string_lossy().to_string(),
    })
}
