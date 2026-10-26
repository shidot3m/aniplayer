use std::path::PathBuf;

use tauri::State;

use crate::player::MpvCore;
use crate::state::AppState;

#[tauri::command]
pub(crate) fn player_init(state: State<'_, AppState>, hwnd: Option<usize>) -> Result<(), String> {
    let dll_candidates = [
        state.app_dir.join("bin/mpv-dev/libmpv-2.dll"),
        state.app_dir.join("libmpv-2.dll"),
        PathBuf::from("bin/mpv-dev/libmpv-2.dll"),
        PathBuf::from("libmpv-2.dll"),
        PathBuf::from("../bin/mpv-dev/libmpv-2.dll"),
        PathBuf::from("dist_portable/libmpv-2.dll"),
        PathBuf::from("../dist_portable/libmpv-2.dll"),
    ];
    let dll_path = dll_candidates
        .into_iter()
        .find(|p| p.exists())
        .ok_or_else(|| "libmpv-2.dll not found".to_string())?;

    let shaders_candidates = [
        state.app_dir.join("shaders/anime4k"),
        PathBuf::from("shaders/anime4k"),
        PathBuf::from("../shaders/anime4k"),
        PathBuf::from("dist_portable/shaders/anime4k"),
        PathBuf::from("../dist_portable/shaders/anime4k"),
    ];
    let shaders_dir = shaders_candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| state.app_dir.join("shaders/anime4k"));

    let core = MpvCore::new(&dll_path, &shaders_dir, hwnd)?;
    let initial_vol = if let Ok(Some(val)) = state.db.get_setting("volume") {
        val.parse::<f64>().unwrap_or(80.0)
    } else {
        80.0
    };
    let _ = core.set_volume(initial_vol);
    let mut p = state.player.lock().map_err(|e| e.to_string())?;
    *p = Some(core);
    Ok(())
}

#[tauri::command]
pub(crate) fn player_load_video(
    state: State<'_, AppState>,
    url: String,
    start_pos: Option<f64>,
) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.load_video(&url, start_pos.unwrap_or(0.0))
    } else {
        Err("Player not initialized".to_string())
    }
}

#[tauri::command]
pub(crate) fn player_play(state: State<'_, AppState>) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.play();
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_pause(state: State<'_, AppState>) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.pause();
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_seek(state: State<'_, AppState>, seconds: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.seek(seconds);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_seek_relative(state: State<'_, AppState>, offset: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.seek_relative(offset);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_set_volume(state: State<'_, AppState>, volume: f64) -> Result<(), String> {
    let _ = state.db.save_setting("volume", &format!("{:.1}", volume));
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.set_volume(volume);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_get_volume(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_volume()
    } else if let Ok(Some(val)) = state.db.get_setting("volume") {
        Ok(val.parse::<f64>().unwrap_or(80.0))
    } else {
        Ok(80.0)
    }
}

#[tauri::command]
pub(crate) fn player_set_speed(state: State<'_, AppState>, speed: f64) -> Result<(), String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        let _ = core.set_speed(speed);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_set_shader_preset(
    state: State<'_, AppState>,
    preset: String,
) -> Result<(), String> {
    let _ = state.db.save_setting("anime4k_preset", &preset);
    let mut p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_mut() {
        let _ = core.set_shader_preset(&preset);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn player_get_current_preset(state: State<'_, AppState>) -> Result<String, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        Ok(core.get_current_preset())
    } else {
        match state.db.get_setting("anime4k_preset") {
            Ok(Some(preset)) => Ok(preset),
            _ => Ok("Mode A+A (HQ)".to_string()),
        }
    }
}

#[tauri::command]
pub(crate) fn player_get_time_pos(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_time_pos()
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
pub(crate) fn player_get_duration(state: State<'_, AppState>) -> Result<f64, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.get_duration()
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
pub(crate) fn player_is_paused(state: State<'_, AppState>) -> Result<bool, String> {
    let p = state.player.lock().map_err(|e| e.to_string())?;
    if let Some(core) = p.as_ref() {
        core.is_paused()
    } else {
        Ok(true)
    }
}

#[tauri::command]
pub(crate) fn player_stop(state: State<'_, AppState>) -> Result<(), String> {
    let mut p = state.player.lock().map_err(|e| e.to_string())?;
    *p = None;
    Ok(())
}
