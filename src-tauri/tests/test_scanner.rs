use aniplayer_lib::codec::{CodecCapabilities, CodecCapabilityReport, CodecFamily, CodecVerdict};
use aniplayer_lib::db::Database;
use aniplayer_lib::downloader::scanner::{
    classify_video, extract_episode_ordinal, find_unsupported_videos, is_playable_in_webview,
    rescan_downloaded_libraries, scan_and_index_torrent_files, scan_unsupported_torrent_files,
    Blocked, Playback,
};
use std::collections::BTreeMap;
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

/// A real file of the payload under test, copied as if a torrent had written it.
fn copy_fixture(name: &str, target: &Path) {
    let source = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name);
    fs::create_dir_all(target.parent().expect("the target has a folder")).expect("folder");
    fs::copy(&source, target).expect("the fixture must be copyable");
}

/// The probe answer of a machine with these exact verdicts. A family nobody named
/// comes back as `unknown`, which is what the probe reports when nothing decided it.
fn probe(verdicts: &[(CodecFamily, CodecVerdict)]) -> CodecCapabilities {
    let mut codecs = BTreeMap::new();
    for family in CodecFamily::ALL {
        let verdict = verdicts
            .iter()
            .find(|(listed, _)| listed == family)
            .map(|(_, verdict)| *verdict)
            .unwrap_or(CodecVerdict::Unknown);
        codecs.insert(*family, verdict);
    }
    let caps = CodecCapabilities::default();
    caps.update(CodecCapabilityReport {
        codecs,
        probed_at: "test".to_string(),
    });
    caps
}

/// The probe answer of a machine that confirmed a decoder for exactly these
/// families. Anything else it was asked about came back undecided.
fn decodes(families: &[CodecFamily]) -> CodecCapabilities {
    probe(
        &families
            .iter()
            .map(|family| (*family, CodecVerdict::Decodable))
            .collect::<Vec<_>>(),
    )
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
fn only_mp4_and_webm_are_demuxed_by_the_webview_itself() {
    assert!(is_playable_in_webview("01.mp4"));
    assert!(is_playable_in_webview("01.WEBM"));
    assert!(!is_playable_in_webview("01.mkv"));
    assert!(!is_playable_in_webview("01.avi"));
    assert!(!is_playable_in_webview("01.ts"));
    assert!(!is_playable_in_webview("readme.txt"));
}

#[test]
fn a_matroska_h264_file_is_offered_for_remux_while_a_webm_is_played_as_is() {
    let folder = temp_folder("classify");
    copy_fixture("h264_aac.mkv", &folder.join("01.mkv"));
    copy_fixture("vp9.webm", &folder.join("02.webm"));
    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac, CodecFamily::Vp9]);

    assert_eq!(
        classify_video(&folder.join("01.mkv"), &caps),
        Playback::Remux,
        "Matroska reaches the player only through the remux"
    );
    assert_eq!(
        classify_video(&folder.join("02.webm"), &caps),
        Playback::Native,
        "the WebView demuxes its own containers"
    );

    let _ = fs::remove_dir_all(&folder);
}

/// A WebM is the WebView's own container: it demuxes codecs this reader has never
/// heard of, so an unnamed codec is no reason to refuse the file. Only a verdict of
/// `undecodable` — the machine saying no — takes a native file away.
#[test]
fn a_webm_with_codecs_this_reader_cannot_name_stays_playable() {
    let folder = temp_folder("webm-unnamed");
    copy_fixture("vp8_vorbis.webm", &folder.join("01.webm"));
    let caps = decodes(&[CodecFamily::Vorbis]);

    assert_eq!(
        classify_video(&folder.join("01.webm"), &caps),
        Playback::Native,
        "VP8 is not a family this reader maps, and the WebView plays it anyway"
    );

    let _ = fs::remove_dir_all(&folder);
}

/// An episode that played yesterday must not vanish because the probe could not
/// decide today: `unknown` is the absence of an answer, not an answer of no.
#[test]
fn an_inconclusive_probe_keeps_a_native_episode_in_the_library() {
    let folder = temp_folder("unknown-verdict");
    copy_fixture("h264_aac.mp4", &folder.join("01.mp4"));
    let caps = probe(&[]);

    assert_eq!(
        classify_video(&folder.join("01.mp4"), &caps),
        Playback::Native,
        "no verdict is not a refusal for a container the WebView demuxes"
    );
    assert_eq!(
        classify_video(
            &folder.join("01.mp4"),
            &decodes(&[CodecFamily::H264, CodecFamily::Aac])
        ),
        Playback::Native,
        "and a confirmed decoder plays it too"
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn a_file_with_no_picture_track_is_not_offered_as_an_episode() {
    let folder = temp_folder("audio-only");
    copy_fixture("audio_only.mkv", &folder.join("01.mkv"));
    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac]);

    let reason = classify_video(&folder.join("01.mkv"), &caps);
    assert!(
        matches!(&reason, Playback::Blocked(Blocked::NotAnEpisode)),
        "an audio-only file is not an episode, got {reason:?}"
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn a_missing_probe_answer_is_reported_as_missing_not_as_a_refusal() {
    let folder = temp_folder("unprobed");
    copy_fixture("h264_aac.mkv", &folder.join("01.mkv"));

    // Nothing was decided about any codec: the remux route will not run on a guess,
    // and the screen must not claim the machine cannot decode H.264.
    let report = find_unsupported_videos(&folder, &probe(&[]));
    assert_eq!(report.len(), 1);
    assert!(
        report[0].reason.contains("не смог выяснить"),
        "the reason has to say the answer is missing: {}",
        report[0].reason
    );
    assert!(
        !report[0].reason.contains("не декодирует"),
        "a missing answer is not a refusal: {}",
        report[0].reason
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn an_undecodable_payload_is_blocked_even_inside_a_demuxable_container() {
    let folder = temp_folder("undecodable");
    copy_fixture("vp9.webm", &folder.join("01.webm"));
    copy_fixture("h264_aac.mkv", &folder.join("02.mkv"));

    // A machine whose probe answered a flat no to VP9 and H.264: the container is
    // fine, the payload is not, and neither file may become a Downloaded episode.
    let caps = probe(&[
        (CodecFamily::Aac, CodecVerdict::Decodable),
        (CodecFamily::Vp9, CodecVerdict::Undecodable),
        (CodecFamily::H264, CodecVerdict::Undecodable),
    ]);
    for name in ["01.webm", "02.mkv"] {
        let reason = match classify_video(&folder.join(name), &caps) {
            Playback::Blocked(reason) => reason,
            other => panic!("{name} must be blocked, got {other:?}"),
        };
        assert!(
            matches!(reason, Blocked::Decoder(_)),
            "{name} must be blocked for want of a decoder, got {reason:?}"
        );
    }

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn a_codec_mp4_cannot_carry_blocks_the_file_with_its_name() {
    let folder = temp_folder("unmapped");
    copy_fixture("h264_opus.mkv", &folder.join("01.mkv"));
    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac, CodecFamily::Opus]);

    // Opus decodes fine here, but MP4 has no sample entry for it, so the remux
    // cannot describe the track.
    let reason = classify_video(&folder.join("01.mkv"), &caps);
    assert!(
        matches!(
            &reason,
            Playback::Blocked(Blocked::Codec(codec)) if codec == "Opus"
        ),
        "the refusal must name the codec the container cannot carry, got {reason:?}"
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn torrent_scan_indexes_the_files_this_machine_can_play() {
    let folder = temp_folder("index");
    copy_fixture("h264_aac.mp4", &folder.join("01.mp4"));
    copy_fixture("h264_aac.mkv", &folder.join("Season 1/02.mkv"));
    copy_fixture("vp9.webm", &folder.join("extras/03.webm"));
    write_file(&folder.join("notes.txt"), b"notes");

    let db = Database::init_in_memory().expect("in-memory database must open");
    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac, CodecFamily::Vp9]);
    let indexed = scan_and_index_torrent_files(&folder, 42, &db, &caps).expect("scan must succeed");

    assert_eq!(indexed, 3, "a remuxable Matroska counts as indexed");
    let mut paths: Vec<String> = db
        .get_all_downloaded_episodes()
        .expect("episodes must be readable")
        .into_iter()
        .map(|episode| episode.file_path)
        .collect();
    paths.sort();
    assert!(
        paths.iter().any(|path| path.ends_with("02.mkv")),
        "the Matroska payload is registered as itself: {paths:?}"
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn torrent_scan_leaves_an_undecodable_episode_out_of_the_library() {
    let folder = temp_folder("gated");
    copy_fixture("hevc_aac.mkv", &folder.join("01.mkv"));
    copy_fixture("h264_aac.mp4", &folder.join("02.mp4"));

    let db = Database::init_in_memory().expect("in-memory database must open");
    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac]);
    let indexed = scan_and_index_torrent_files(&folder, 42, &db, &caps).expect("scan must succeed");

    assert_eq!(
        indexed, 1,
        "only the H.264 file may be opened by the player"
    );
    let left = db
        .get_all_downloaded_episodes()
        .expect("episodes must be readable");
    assert_eq!(left.len(), 1);
    assert!(left[0].file_path.ends_with("02.mp4"));

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn unsupported_report_names_the_way_out_for_each_file() {
    let folder = temp_folder("unsupported");
    copy_fixture("hevc_aac.mkv", &folder.join("01.mkv"));
    // Not a video at all: the reader cannot get past its first bytes, which is a
    // dead end the screen still has to explain honestly.
    write_file(&folder.join("02.avi"), b"avi");

    let caps = probe(&[
        (CodecFamily::H264, CodecVerdict::Decodable),
        (CodecFamily::Aac, CodecVerdict::Decodable),
        (CodecFamily::Hevc, CodecVerdict::Undecodable),
    ]);
    let report = find_unsupported_videos(&folder, &caps);

    let found: Vec<(&str, &str)> = report
        .iter()
        .map(|file| (file.file_name.as_str(), file.reason.as_str()))
        .collect();
    assert_eq!(
        found.iter().map(|(name, _)| *name).collect::<Vec<_>>(),
        vec!["01.mkv", "02.avi"]
    );
    assert!(
        found[0].1.contains("HEVC") && found[0].1.contains("внешнем плеере"),
        "a missing decoder has to be named with its way out: {}",
        found[0].1
    );
    assert!(
        found[0].1.contains("H.264"),
        "the in-app way out is the H.264 download: {}",
        found[0].1
    );
    assert!(
        found[1].1.contains("контейнер") && !found[1].1.contains("H.264"),
        "an unreadable file is a container story, not a codec one: {}",
        found[1].1
    );

    let _ = fs::remove_dir_all(&folder);
}

#[test]
fn unsupported_report_groups_files_by_release_folder() {
    let torrents_root = temp_folder("releases");
    copy_fixture("hevc_aac.mkv", &torrents_root.join("42/02.mkv"));
    copy_fixture("h264_aac.mp4", &torrents_root.join("42/01.mp4"));
    copy_fixture("h264_aac.mkv", &torrents_root.join("77/05.mkv"));
    copy_fixture(
        "h264_aac.mkv",
        &torrents_root.join("not-a-release/ignored.mkv"),
    );

    let caps = decodes(&[CodecFamily::H264, CodecFamily::Aac]);
    let report = scan_unsupported_torrent_files(&torrents_root, &caps);

    let entries: Vec<(i64, &str)> = report
        .iter()
        .map(|file| (file.release_id, file.file_name.as_str()))
        .collect();
    assert_eq!(
        entries,
        vec![(42, "02.mkv")],
        "only the undecodable file is reported: {entries:?}"
    );

    let _ = fs::remove_dir_all(&torrents_root);
}

#[test]
fn a_decoder_removed_later_empties_the_library_of_episodes_it_cannot_play() {
    let torrents_root = temp_folder("rescan");
    copy_fixture("h264_aac.mkv", &torrents_root.join("42/01.mkv"));

    let db = Database::init_in_memory().expect("in-memory database must open");
    let playable = scan_and_index_torrent_files(
        &torrents_root.join("42"),
        42,
        &db,
        &decodes(&[CodecFamily::H264, CodecFamily::Aac]),
    )
    .expect("the first scan must succeed");
    assert_eq!(playable, 1);

    // The same machine after its H.264 decoder goes away, reported again at startup.
    let kept = rescan_downloaded_libraries(
        &torrents_root,
        &db,
        &decodes(&[CodecFamily::Aac, CodecFamily::Vp9]),
    )
    .expect("the rescan must succeed");

    assert_eq!(kept, 0, "nothing is playable on this machine now");
    assert!(
        db.get_all_downloaded_episodes()
            .expect("episodes must be readable")
            .is_empty(),
        "an entry that opens on a black frame must not stay in the library"
    );

    let _ = fs::remove_dir_all(&torrents_root);
}
