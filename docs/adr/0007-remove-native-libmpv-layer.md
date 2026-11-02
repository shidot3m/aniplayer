# 7. Remove the native libmpv playback layer

Date: 2026-11-02

Status: accepted

## Context

[ADR 0003](0003-native-libmpv-ffi-layer.md) introduced a runtime-loaded `libmpv` FFI layer as the native media backend. The Player overlay never adopted it: since the `<video>` pipeline landed, playback runs through hls.js and Anime4K runs through `anime4k-webgpu`. Nothing called `player_init`, so every `player_*` command returned a default or did nothing.

The dead layer still cost real maintenance: an `unsafe` FFI module behind `libloading`, 14 IPC commands and their handler registrations, an `AppState` field, a DLL download in the release workflow, 39 tracked GLSL shader files copied into the portable zip, and documentation that had to explain why the registered backend was inactive.

## Decision

- Delete the `player` Rust module (`ffi.rs`, `mpv.rs`, `shaders.rs`), `commands/player.rs`, their handler registrations, `AppState.player`, the `libloading` dependency, and `test_player`.
- Remove every `player_*` invoke from `playerStore`, along with the 500 ms backend polling hook and its backend-sync actions. Playback state stays client-side; volume, preferred Quality, Anime4K preset, Anime4K enabled, and hotkeys keep persisting through `db_save_setting` and browser storage.
- Delete the tracked `shaders/anime4k/*.glsl` files. The WebView renders Anime4K through `anime4k-webgpu`, which bundles its own shader data, so the GLSL copies had no reader.
- Drop the `libmpv` download step, the DLL and shader copies, and the related archive checks from the release path. `Aniplayer-portable.zip` contains `aniplayer.exe` and an empty `data/` folder.
- Keep playback and enhancement in the WebView: hls.js over `<video>` for online HLS, the asset protocol for downloads, and a WebGPU canvas for Anime4K.

## Considered options

- **Keep the layer as a future backend** — rejected: it has no caller, its FFI surface must be maintained and audited, and it ships binaries and shaders that are never used. Reintroducing a native backend is a new decision, not a dormant one.
- **Wire the native backend into the overlay** — rejected: it would duplicate the working WebView pipeline, and Anime4K would have to move from WebGPU back to libmpv shader chains.
- **Keep the DLL/shaders without the code** — rejected: unused runtime assets inflate the archive and imply a capability the app does not have.

## Consequences

- The portable zip shrinks to the executable and its data folder; the release workflow no longer downloads mpv builds.
- The Rust backend contains no `unsafe` FFI for playback and no `libloading` dependency; command surface is limited to catalog, storage, downloads, and window control.
- Settings survive unchanged: they were already persisted in `app_data.app_settings` (and mirrored in browser storage), not in the player.
- Restoring native playback would require a fresh ADR and a new FFI or process-isolation design.
