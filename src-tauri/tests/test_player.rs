use aniplayer_lib::player::mpv::MpvCore;
use std::path::PathBuf;

#[test]
fn test_mpv_headless_init_and_presets() {
    let shaders_dir = PathBuf::from("shaders/anime4k");
    let mut player = MpvCore::new_headless(&shaders_dir).expect("Failed to initialize headless MPV");
    
    // Test volume property
    player.set_volume(80.0).expect("Set volume failed");
    assert_eq!(player.get_volume().unwrap(), 80.0);

    // Test default preset A+A
    player.set_shader_preset("A+A").expect("Set A+A preset failed");
    let shaders = player.get_active_shaders().expect("Get active shaders failed");
    assert!(shaders.contains("Anime4K_Clamp_Highlights.glsl"));
    assert!(shaders.contains("Anime4K_Restore_CNN_VL.glsl"));
    assert!(shaders.contains("Anime4K_Restore_CNN_M.glsl"));

    // Test disable shaders
    player.set_shader_preset("OFF").expect("Set OFF preset failed");
    let shaders_off = player.get_active_shaders().expect("Get active shaders failed");
    assert!(shaders_off.is_empty() || shaders_off == "");
}
