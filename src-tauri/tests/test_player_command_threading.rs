//! Every player command must run off the main thread.
//!
//! `MpvSupervisor` guards its mpv session with one mutex. `open()` holds that mutex for the
//! whole startup of a session — spawning mpv, connecting the JSON IPC pipe, loading the file —
//! and inside the critical section it calls window APIs (`inner_position`, `set_position`,
//! `show`, `set_always_on_top`, `set_focus`) that are serviced by the application main thread.
//! Tauri runs a command without `async` on that same main thread, so a pause, seek, volume,
//! speed, Anime4K or close request arriving while a session is starting blocks the main thread
//! on the mutex that the starter holds while it waits on the main thread: a deadlock that stops
//! every IPC reply, not only the player's. Reproduced in the #30 runtime pass by pausing during
//! playback startup, which left the window accepting no commands at all.
//!
//! The guard is textual because the property lives in the `#[tauri::command]` attribute: a
//! handler is off the main thread only if it is an `async fn` or annotated
//! `#[tauri::command(async)]`.

const PLAYER_COMMAND_SOURCE: &str = include_str!("../src/commands/player.rs");

/// `(command name, whether it can run on the main thread)` for every declared command.
fn declared_commands() -> Vec<(String, bool)> {
    let mut commands = Vec::new();
    let mut annotated_async = false;
    for line in PLAYER_COMMAND_SOURCE.lines() {
        let line = line.trim();
        if line.starts_with("#[tauri::command") {
            annotated_async = line.contains("(async)");
            continue;
        }
        let Some(rest) = line.strip_prefix("pub(crate) ") else {
            continue;
        };
        let is_async_fn = rest.starts_with("async fn ");
        let name = rest
            .trim_start_matches("async fn ")
            .trim_start_matches("fn ")
            .split('(')
            .next()
            .unwrap_or_default()
            .to_string();
        commands.push((name, is_async_fn || annotated_async));
        annotated_async = false;
    }
    commands
}

#[test]
fn all_player_commands_are_covered() {
    let commands = declared_commands();
    let names: Vec<&str> = commands.iter().map(|(name, _)| name.as_str()).collect();
    for expected in [
        "player_open",
        "player_close",
        "player_set_pause",
        "player_seek",
        "player_set_volume",
        "player_set_speed",
        "player_set_anime4k",
    ] {
        assert!(
            names.contains(&expected),
            "{expected} is not parsed as a command"
        );
    }
}

#[test]
fn no_player_command_runs_on_the_main_thread() {
    let commands = declared_commands();
    let on_main_thread: Vec<&str> = commands
        .iter()
        .filter(|(_, off_main_thread)| !*off_main_thread)
        .map(|(name, _)| name.as_str())
        .collect();
    assert!(
        on_main_thread.is_empty(),
        "these player commands would deadlock the IPC loop while a session starts: {on_main_thread:?}"
    );
}
