use aniplayer_lib::player::{Anime4kPreset, PlaybackEvents, PlayerEvent};

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
