use aniplayer_lib::player::{validate_playback_source, Anime4kPreset, PlaybackEvents, PlayerEvent};

#[test]
fn mpv_property_events_drive_time_and_duration() {
    let mut events = PlaybackEvents::default();

    let duration = events
        .handle_line(r#"{"event":"property-change","name":"duration","data":1440.5}"#)
        .expect("duration must produce an update");
    assert_eq!(
        duration,
        PlayerEvent::Time {
            position: 0.0,
            duration: 1440.5,
        }
    );

    let position = events
        .handle_line(r#"{"event":"property-change","name":"time-pos","data":125.25}"#)
        .expect("position must produce an update");
    assert_eq!(
        position,
        PlayerEvent::Time {
            position: 125.25,
            duration: 1440.5,
        }
    );
}

#[test]
fn mpv_end_of_file_is_distinguished_from_a_fault() {
    let mut events = PlaybackEvents::default();

    assert_eq!(
        events.handle_line(r#"{"event":"end-file","reason":"eof"}"#),
        Some(PlayerEvent::Ended)
    );
    assert!(matches!(
        events.handle_line(r#"{"event":"end-file","reason":"error","file_error":"bad input"}"#),
        Some(PlayerEvent::Fault { message }) if message.contains("bad input")
    ));
}

/// The frontend sends the open request as one camelCase object; the field names
/// have to survive that boundary exactly.
#[test]
fn open_request_deserializes_the_frontend_payload() {
    let payload = r#"{
        "source": "https://test/ep1.m3u8",
        "start": 125,
        "volume": 80,
        "muted": false,
        "speed": 1,
        "anime4kEnabled": true,
        "preset": "Mode A+A (HQ)"
    }"#;
    let request: aniplayer_lib::player::MpvOpenRequest =
        serde_json::from_str(payload).expect("payload must deserialize");
    assert_eq!(request.source, "https://test/ep1.m3u8");
    assert_eq!(request.start, 125.0);
    assert!(request.anime4k_enabled);
    assert_eq!(request.preset, "Mode A+A (HQ)");
}

/// The player keeps the last frame on screen (`keep-open=yes`), so mpv reports the
/// end of an episode through the `eof-reached` flag rather than `end-file`.
#[test]
fn eof_flag_ends_the_episode_while_keep_open_holds_the_frame() {
    let mut events = PlaybackEvents::default();

    assert_eq!(
        events.handle_line(r#"{"event":"property-change","name":"eof-reached","data":true}"#),
        Some(PlayerEvent::Ended)
    );
    assert_eq!(
        events.handle_line(r#"{"event":"property-change","name":"eof-reached","data":false}"#),
        None
    );
}

#[test]
fn every_anime4k_preset_maps_to_real_shader_files() {
    let labels = [
        "Mode A (HQ)",
        "Mode A+A (HQ)",
        "Mode B (HQ)",
        "Mode B+B (HQ)",
        "Mode C (HQ)",
        "Mode C+A (HQ)",
        "Mode Fast (APU)",
    ];

    for label in labels {
        let preset = Anime4kPreset::from_label(label);
        let files = preset.shader_file_names();
        assert!(!files.is_empty(), "{label} must enable a shader chain");
        for file in files {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("shaders")
                .join("anime4k")
                .join(file);
            assert!(path.is_file(), "missing shader for {label}: {path:?}");
        }
    }
}

/// `player_open` is the only door to the media filesystem, so its source gate is
/// part of the player's contract, not a supervisor detail.
#[test]
fn downloaded_files_are_confined_to_the_downloads_folder() {
    let dir = std::env::temp_dir().join(format!(
        "aniplayer-source-{}-{}",
        std::process::id(),
        NEXT_SOURCE_TEST.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    let downloads = dir.join("downloads");
    std::fs::create_dir_all(&downloads).unwrap();
    let file = downloads.join("episode.mkv");
    std::fs::write(&file, b"fixture").unwrap();

    // A Windows path with a drive letter parses as a URL whose scheme is the
    // letter itself; it must still reach the downloads-folder branch.
    let accepted = validate_playback_source(&dir, &file.to_string_lossy())
        .expect("a downloaded file must be playable");
    assert!(accepted.ends_with("episode.mkv"));

    let escaped = dir.join("outside.mkv");
    std::fs::write(&escaped, b"fixture").unwrap();
    assert!(validate_playback_source(&dir, &escaped.to_string_lossy())
        .unwrap_err()
        .contains("outside the downloads folder"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn only_http_streams_are_accepted_as_urls() {
    let dir = std::env::temp_dir();
    assert_eq!(
        validate_playback_source(&dir, "ftp://host/episode.mkv").unwrap_err(),
        "Only HTTP(S) streams and downloaded episodes can be played"
    );
    assert_eq!(
        validate_playback_source(&dir, "").unwrap_err(),
        "This episode has no playable source"
    );
    assert!(
        validate_playback_source(&dir, "https://cdn.test/episode.m3u8")
            .unwrap()
            .starts_with("https://cdn.test/")
    );
}

static NEXT_SOURCE_TEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
