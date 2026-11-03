use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};

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

pub fn extract_episode_ordinal(filename: &str) -> Option<f64> {
    if !is_video_file(filename) {
        return None;
    }

    if let Ok(re1) = Regex::new(r"(?i)(?:e|ep|серия|эпизод|episode)[\s_.-]*(\d{1,4})") {
        if let Some(caps) = re1.captures(filename) {
            if let Some(m) = caps.get(1) {
                if let Ok(num) = m.as_str().parse::<f64>() {
                    return Some(num);
                }
            }
        }
    }

    if let Ok(re2) = Regex::new(r"(?:[_\s\-\[\(])(\d{1,4})(?:[_\s\-\]\)\.])") {
        if let Some(caps) = re2.captures(filename) {
            if let Some(m) = caps.get(1) {
                if let Ok(num) = m.as_str().parse::<f64>() {
                    return Some(num);
                }
            }
        }
    }

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
