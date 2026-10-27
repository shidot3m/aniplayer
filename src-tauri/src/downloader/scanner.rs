use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use regex::Regex;
use std::fs;
use std::path::Path;

/// Extracts the episode ordinal from a video filename
pub fn extract_episode_ordinal(filename: &str) -> Option<f64> {
    let lower = filename.to_lowercase();
    if !lower.ends_with(".mkv")
        && !lower.ends_with(".mp4")
        && !lower.ends_with(".avi")
        && !lower.ends_with(".webm")
    {
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

/// Recursively scans folder for video files and registers them into the database
pub fn scan_and_index_torrent_files(
    folder: &Path,
    release_id: i64,
    db: &Database,
) -> Result<usize, String> {
    if !folder.exists() {
        return Ok(0);
    }

    let mut indexed_count = 0;
    let mut files_to_visit = vec![folder.to_path_buf()];

    while let Some(current_dir) = files_to_visit.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    files_to_visit.push(path);
                } else if path.is_file() {
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if let Some(ordinal) = extract_episode_ordinal(filename) {
                        let file_size = entry.metadata().map(|m| m.len() as i64).unwrap_or(0);
                        let file_path = path.to_string_lossy().to_string();
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
                            file_path,
                            file_size,
                            quality,
                            opening_start: None,
                            opening_stop: None,
                            ending_start: None,
                            ending_stop: None,
                            download_status: "COMPLETED".to_string(),
                        };

                        if let Ok(()) = db.save_downloaded_episode(&meta) {
                            indexed_count += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(indexed_count)
}
