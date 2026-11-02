use crate::codec::{CodecCapabilities, CodecVerdict};
use crate::db::models::DownloadedEpisodeMeta;
use crate::db::Database;
use crate::remux::Container;
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

/// How a downloaded file can reach the player, decided by what the container holds
/// and by what this machine's WebView said it can decode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Playback {
    /// The WebView demuxes the container itself.
    Native,
    /// Matroska the app remuxes into MP4 before the WebView sees it.
    Remux,
    /// Nothing can play it, and the reason says why.
    Blocked(Blocked),
}

impl Playback {
    fn is_blocked(&self) -> bool {
        matches!(self, Playback::Blocked(_))
    }
}

/// Why a file is not offered for playback. The two codec-shaped variants are the
/// ones the user can act on differently: one is this app's limitation, the other is
/// this machine's.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Blocked {
    /// No reader for this container.
    Container,
    /// A track whose codec the app cannot describe to the WebView.
    Codec(String),
    /// A codec the container describes fine, but this machine cannot decode.
    Decoder(&'static str),
    /// A readable video file with no picture track: not an episode.
    NotAnEpisode,
    /// The remux route needs a confirmed decoder, and the probe never answered for
    /// this codec — no verdict, which is not the same as a refusal.
    Unprobed(&'static str),
    /// The file could not be read far enough to tell.
    Unreadable(String),
}

impl Blocked {
    /// The message the Downloads screen shows for this reason. A missing decoder is
    /// this machine's limit, so the external player is the way out; a container or
    /// codec this app cannot handle points at a different download instead.
    pub fn explanation(&self) -> String {
        match self {
            Blocked::Container => {
                "Aniplayer не разбирает этот контейнер — перекодируйте его в MP4 или \
                 откройте во внешнем плеере"
                    .to_string()
            }
            Blocked::Codec(codec) => format!(
                "Aniplayer не может пересобрать этот файл в MP4 ({codec}) — скачайте раздачу \
                 с H.264 или откройте файл во внешнем плеере"
            ),
            Blocked::Decoder(codec) => format!(
                "Этот компьютер не декодирует {codec} во встроенном плеере — откройте файл \
                 во внешнем плеере или скачайте раздачу с H.264"
            ),
            Blocked::NotAnEpisode => "В этом файле нет видеодорожки — это не серия".to_string(),
            Blocked::Unprobed(codec) => format!(
                "Aniplayer не смог выяснить, декодирует ли этот компьютер {codec}, а для \
                 пересборки в MP4 это нужно знать — перезапустите приложение или откройте \
                 файл во внешнем плеере"
            ),
            Blocked::Unreadable(reason) => format!("Файл не читается: {reason}"),
        }
    }
}

/// Reads the container's own description of itself and asks the probe what this
/// machine can decode, so a file is only offered when it will actually show a
/// picture.
///
/// The two routes are judged differently on purpose. A container the WebView demuxes
/// is the WebView's business: this app cannot name every codec it carries, and an
/// inconclusive probe must not throw away an episode that played yesterday — so only
/// a verdict of `undecodable` blocks it. A Matroska file has to pass through this
/// app's own writer first, so here every track must be one the reader can describe
/// and the machine has confirmed it decodes.
pub fn classify_video(path: &Path, caps: &CodecCapabilities) -> Playback {
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if !is_video_file(filename) {
        return Playback::Blocked(Blocked::Container);
    }

    let streams = match crate::remux::sniff_streams(path) {
        Ok(streams) => streams,
        Err(error) => return Playback::Blocked(Blocked::Unreadable(error.to_string())),
    };
    // Nothing here reads the container, so there is no payload to talk about: the
    // story is the file itself, not a codec or a decoder.
    if streams.container == Container::Other {
        return Playback::Blocked(Blocked::Container);
    }
    let native = is_playable_in_webview(filename) || streams.container == Container::Mp4;
    if native {
        // Only the codecs this reader can name can be judged; the WebView decides
        // about the rest, and it demuxes this container itself.
        for family in streams
            .video
            .into_iter()
            .chain(streams.audio.iter().copied())
        {
            if caps.verdict(family) == CodecVerdict::Undecodable {
                return Playback::Blocked(Blocked::Decoder(family.label()));
            }
        }
        return Playback::Native;
    }

    if streams.container != Container::Matroska {
        return Playback::Blocked(Blocked::Container);
    }
    // Matroska reaches the player only by becoming an MP4, so this reader has to be
    // able to name every track and describe it with a sample entry it implements.
    let Some(video) = streams.video else {
        return Playback::Blocked(if streams.has_video {
            Blocked::Codec(streams.unknown_codecs.join(", "))
        } else {
            Blocked::NotAnEpisode
        });
    };
    if !streams.names_every_track() {
        return Playback::Blocked(Blocked::Codec(streams.unknown_codecs.join(", ")));
    }
    match caps.verdict(video) {
        CodecVerdict::Decodable => {}
        // The remux route is this app's own work, so it only runs on a decoder the
        // probe confirmed. A missing answer is reported as missing, not as a refusal.
        CodecVerdict::Unknown => return Playback::Blocked(Blocked::Unprobed(video.label())),
        CodecVerdict::Undecodable => return Playback::Blocked(Blocked::Decoder(video.label())),
    }
    // Audio is only refused when this machine definitely cannot decode it: an unknown
    // audio verdict should not cost the user the picture.
    for family in &streams.audio {
        if caps.verdict(*family) == CodecVerdict::Undecodable {
            return Playback::Blocked(Blocked::Decoder(family.label()));
        }
    }
    let unmapped = std::iter::once(video)
        .chain(streams.audio.iter().copied())
        .find(|family| crate::remux::mp4_entry(*family).is_none());
    match unmapped {
        Some(family) => Playback::Blocked(Blocked::Codec(family.label().to_string())),
        None => Playback::Remux,
    }
}

/// A video file this app cannot offer for playback, with the reason the Downloads
/// screen shows: a container it cannot remux is a different dead end from a codec
/// this machine cannot decode.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnsupportedVideoFile {
    pub file_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnsupportedTorrentFile {
    pub release_id: i64,
    pub file_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub reason: String,
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

/// Lists the video files in a torrent folder that this app cannot offer for
/// playback, each with the reason it stopped.
pub fn find_unsupported_videos(
    folder: &Path,
    caps: &CodecCapabilities,
) -> Vec<UnsupportedVideoFile> {
    if !folder.exists() {
        return Vec::new();
    }

    let mut files: Vec<UnsupportedVideoFile> = walk_files(folder)
        .into_iter()
        .filter_map(|path| {
            let Playback::Blocked(reason) = classify_video(&path, caps) else {
                return None;
            };
            // A file that is not a video at all — the torrent's subtitle track or
            // sample — is nobody's dead end, so it stays out of the report.
            let file_name = path.file_name()?.to_str()?.to_string();
            if !is_video_file(&file_name) {
                return None;
            }
            let file_size = fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(0);
            Some(UnsupportedVideoFile {
                reason: reason.explanation(),
                file_name,
                file_path: path.to_string_lossy().to_string(),
                file_size,
            })
        })
        .collect();
    files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    files
}

/// Reports files this app cannot play across every downloaded torrent, grouped by
/// the release folder they live in.
pub fn scan_unsupported_torrent_files(
    torrents_root: &Path,
    caps: &CodecCapabilities,
) -> Vec<UnsupportedTorrentFile> {
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
        for file in find_unsupported_videos(&path, caps) {
            report.push(UnsupportedTorrentFile {
                release_id,
                reason: file.reason,
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

/// Rebuilds the downloaded library from what the files are and what this machine
/// can decode: files that play are registered, and entries registered under an
/// earlier answer — a decoder installed or removed since — are dropped. Returns
/// how many entries are playable now.
pub fn rescan_downloaded_libraries(
    torrents_root: &Path,
    db: &Database,
    caps: &CodecCapabilities,
) -> Result<usize, String> {
    let mut kept = 0usize;
    for entry in db
        .get_all_downloaded_episodes()
        .map_err(|e| e.to_string())?
    {
        if !entry.episode_id.starts_with("torrent-") {
            continue;
        }
        let path = Path::new(&entry.file_path);
        // An HLS download owns its own playlist and stays as it is.
        if classify_video(path, caps).is_blocked() || !path.is_file() {
            db.delete_downloaded_episode(&entry.episode_id)
                .map_err(|e| e.to_string())?;
            continue;
        }
        kept += 1;
    }

    let Ok(release_folders) = fs::read_dir(torrents_root) else {
        return Ok(kept);
    };
    for folder in release_folders.flatten() {
        let path = folder.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(release_id) = path
            .file_name()
            .and_then(|name| name.to_str())
            .and_then(|name| name.parse::<i64>().ok())
        {
            scan_and_index_torrent_files(&path, release_id, db, caps)?;
        }
    }
    Ok(kept)
}

/// Recursively scans folder for video files this app can play — natively or after a
/// remux — and registers them into the database.
pub fn scan_and_index_torrent_files(
    folder: &Path,
    release_id: i64,
    db: &Database,
    caps: &CodecCapabilities,
) -> Result<usize, String> {
    if !folder.exists() {
        return Ok(0);
    }

    let mut indexed_count = 0;
    for path in walk_files(folder) {
        if classify_video(&path, caps).is_blocked() {
            continue;
        }
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
