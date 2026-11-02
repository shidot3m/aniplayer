use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use regex::Regex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Container extensions WebView2 can demux through a `<video>` element.
const PLAYABLE_EXTENSIONS: &[&str] = &["mp4", "webm"];

/// Video container extensions the scanner recognises, including those the
/// WebView cannot demux (Matroska, AVI, and similar).
const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "webm", "mkv", "avi", "mov", "m4v", "ts", "m2ts", "flv", "wmv", "mpg", "mpeg",
];

fn extension(filename: &str) -> Option<String> {
    filename
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
}

pub fn is_video_file(filename: &str) -> bool {
    extension(filename).is_some_and(|ext| VIDEO_EXTENSIONS.contains(&ext.as_str()))
}

pub fn is_playable_in_webview(filename: &str) -> bool {
    extension(filename).is_some_and(|ext| PLAYABLE_EXTENSIONS.contains(&ext.as_str()))
}

/// A video file that the WebView player cannot open, reported so the user can
/// retry with a playable container instead of seeing an empty library.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnsupportedVideoFile {
    pub file_name: String,
    pub file_path: String,
    pub file_size: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnsupportedTorrentFile {
    pub release_id: i64,
    pub file_name: String,
    pub file_path: String,
    pub file_size: i64,
}

/// Extracts the episode ordinal from a video filename
pub fn extract_episode_ordinal(filename: &str) -> Option<f64> {
    if !is_video_file(filename) {
        return None;
    }

    // Pattern 1: E01, Ep 01, Серия 01, Эпизод 01, Part_3_Ep_08
    if let Ok(re1) = Regex::new(r"(?i)(?:e|ep|серия|эпизод|episode)[\s_.-]*(\d{1,4})") {
        if let Some(caps) = re1.captures(filename) {
            if let Some(m) = caps.get(1) {
                if let Ok(num) = m.as_str().parse::<f64>() {
                    return Some(num);
                }
            }
        }
    }

    // Pattern 2: standalone numbers surrounded by - or _ or spaces or brackets: e.g. " - 01 ", "_01_", "[01]"
    if let Ok(re2) = Regex::new(r"(?:[_\s\-\[\(])(\d{1,4})(?:[_\s\-\]\)\.])") {
        if let Some(caps) = re2.captures(filename) {
            if let Some(m) = caps.get(1) {
                if let Ok(num) = m.as_str().parse::<f64>() {
                    return Some(num);
                }
            }
        }
    }

    // Pattern 3: Starts with number, e.g. "01.mp4" or "01 - Name.mkv"
    if let Ok(re3) = Regex::new(r"^(\d{1,4})(?:[_\s\-\.])") {
        if let Some(caps) = re3.captures(filename) {
            if let Some(m) = caps.get(1) {
                if let Ok(num) = m.as_str().parse::<f64>() {
                    return Some(num);
                }
            }
        }
    }

    None
}

fn walk_files(folder: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut pending = vec![folder.to_path_buf()];

    while let Some(current_dir) = pending.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    pending.push(path);
                } else if path.is_file() {
                    files.push(path);
                }
            }
        }
    }

    files
}

/// Lists the video files in a torrent folder that the WebView cannot play.
pub fn find_unsupported_videos(folder: &Path) -> Vec<UnsupportedVideoFile> {
    if !folder.exists() {
        return Vec::new();
    }

    let mut files: Vec<UnsupportedVideoFile> = walk_files(folder)
        .into_iter()
        .filter_map(|path| {
            let file_name = path.file_name()?.to_str()?.to_string();
            if !is_video_file(&file_name) || is_playable_in_webview(&file_name) {
                return None;
            }
            let file_size = fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(0);
            Some(UnsupportedVideoFile {
                file_name,
                file_path: path.to_string_lossy().to_string(),
                file_size,
            })
        })
        .collect();
    files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    files
}

/// Reports files the WebView cannot play across every downloaded torrent,
/// grouped by the release folder they live in.
pub fn scan_unsupported_torrent_files(torrents_root: &Path) -> Vec<UnsupportedTorrentFile> {
    let Ok(entries) = fs::read_dir(torrents_root) else {
        return Vec::new();
    };

    let mut report = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(release_id) = path
            .file_name()
            .and_then(|name| name.to_str())
            .and_then(|name| name.parse::<i64>().ok())
        else {
            continue;
        };
        for file in find_unsupported_videos(&path) {
            report.push(UnsupportedTorrentFile {
                release_id,
                file_name: file.file_name,
                file_path: file.file_path,
                file_size: file.file_size,
            });
        }
    }
    report.sort_by(|a, b| {
        a.release_id
            .cmp(&b.release_id)
            .then_with(|| a.file_path.cmp(&b.file_path))
    });
    report
}

/// Recursively scans folder for playable video files and registers them into the database
pub fn scan_and_index_torrent_files(
    folder: &Path,
    release_id: i64,
    db: &Database,
) -> Result<usize, String> {
    if !folder.exists() {
        return Ok(0);
    }

    let mut indexed_count = 0;
    for path in walk_files(folder) {
        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !is_playable_in_webview(filename) {
            continue;
        }
        let Some(ordinal) = extract_episode_ordinal(filename) else {
            continue;
        };
        let file_size = fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(0);
        let quality = if filename.to_lowercase().contains("1080") {
            "1080p".to_string()
        } else if filename.to_lowercase().contains("720") {
            "720p".to_string()
        } else if filename.to_lowercase().contains("hevc")
            || filename.to_lowercase().contains("x265")
        {
            "HEVC".to_string()
        } else {
            "1080p".to_string()
        };

        let meta = DownloadedEpisodeMeta {
            episode_id: format!("torrent-{}-{}", release_id, ordinal as i64),
            release_id,
            episode_ordinal: ordinal,
            file_path: path.to_string_lossy().to_string(),
            file_size,
            quality,
            opening_start: None,
            opening_stop: None,
            ending_start: None,
            ending_stop: None,
            download_status: "COMPLETED".to_string(),
        };

        if db.save_downloaded_episode(&meta).is_ok() {
            indexed_count += 1;
        }
    }

    Ok(indexed_count)
}
