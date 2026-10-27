use aniplayer_lib::player::ffi::MpvFfi;
use aniplayer_lib::player::mpv::MpvCore;
use std::path::PathBuf;

fn dll_path() -> PathBuf {
    [
        "../dist_portable/libmpv-2.dll",
        "dist_portable/libmpv-2.dll",
        "bin/mpv-dev/libmpv-2.dll",
        "libmpv-2.dll",
    ]
    .into_iter()
    .map(PathBuf::from)
    .find(|p| p.exists())
    .expect("libmpv-2.dll not found for player tests")
}

#[test]
fn test_mpv_headless_init_and_presets() {
    let shaders_dir = PathBuf::from("shaders/anime4k");
    let mut player =
        MpvCore::new_headless(&shaders_dir).expect("Failed to initialize headless MPV");

    // Test volume property
    player.set_volume(80.0).expect("Set volume failed");
    assert_eq!(player.get_volume().unwrap(), 80.0);

    // Test default preset A+A
    player
        .set_shader_preset("A+A")
        .expect("Set A+A preset failed");
    let shaders = player
        .get_active_shaders()
        .expect("Get active shaders failed");
    assert!(shaders.contains("Anime4K_Clamp_Highlights.glsl"));
    assert!(shaders.contains("Anime4K_Restore_CNN_VL.glsl"));
    assert!(shaders.contains("Anime4K_Restore_CNN_M.glsl"));

    // Test disable shaders
    player
        .set_shader_preset("OFF")
        .expect("Set OFF preset failed");
    let shaders_off = player
        .get_active_shaders()
        .expect("Get active shaders failed");
    assert!(shaders_off.is_empty());
}

#[test]
fn headless_core_can_be_created_and_dropped_repeatedly() {
    let shaders_dir = PathBuf::from("shaders/anime4k");
    for _ in 0..3 {
        let player =
            MpvCore::new_headless(&shaders_dir).expect("Failed to initialize headless MPV");
        player.set_volume(50.0).expect("Set volume failed");
        drop(player);
    }
}

#[test]
fn test_failed_initialization_destroys_mpv_handle() {
    let ffi = std::sync::Arc::new(MpvFfi::load(&dll_path()).expect("Failed to load libmpv"));
    for _ in 0..300 {
        let ctx = ffi.create_context().expect("mpv_create failed");
        let err = ffi
            .set_option_string(&ctx, "definitely-not-an-mpv-option", "1")
            .expect_err("bogus option must fail before initialization");
        assert!(!err.is_empty());
        drop(ctx);
    }
}
