# 3. Native libmpv FFI layer inside a Tauri shell

Date: 2026-11-02

Status: superseded by [ADR 0007](0007-remove-native-libmpv-layer.md)

## Context

Aniplayer is a Windows-only desktop app whose UI is React in a Tauri 2 WebView. The approved design calls for hardware decoding, precise seeking, and Anime4K GLSL shaders, which a browser `<video>` element cannot fully provide. The app must also stay portable: a user should be able to run one folder without installing a media framework or matching a compiler toolchain.

## Decision

- The shell is Tauri 2 with a React frontend; the frontend reaches native media through the `player_*` IPC commands.
- `libmpv-2.dll` is loaded at runtime through `libloading`, never linked at build time. The DLL is resolved from a fixed candidate list: the application directory, the working directory, `bin/mpv-dev/`, and `dist_portable/`.
- All unsafe libmpv calls live in `src-tauri/src/player/ffi.rs`. `MpvContext` owns the `mpv_handle` as a `NonNull`, implements `Drop` through `mpv_terminate_destroy`, and never exposes the raw pointer. `MpvCore` in `mpv.rs` is the safe facade used by commands.
- The player is optional state (`Arc<Mutex<Option<MpvCore>>>`): a missing DLL or a failed initialization degrades playback instead of preventing the catalog, downloads, and library features from starting.
- Video is rendered by mpv into the webview window via the `wid` option; decoding uses `hwdec=auto-safe` and output uses `vo=gpu-next`. Anime4K presets are applied as a `;`-separated GLSL chain through `change-list glsl-shaders`.
- Anime4K shader files are read from `shaders/anime4k/` beside the executable, with development fallbacks to the repository directory.

## Considered options

- **Link libmpv at build time** — rejected: it requires the import library and headers during every build and makes a missing runtime DLL a link error instead of a recoverable startup state.
- **Use FFmpeg or VLC directly** — rejected: more integration code for seeking, shaders, and hardware decoding than libmpv provides out of the box.
- **WebView-only playback** — rejected as the long-term backend: it cannot apply mpv's GLSL shader pipeline and gives less control over decoding and seeking. It remains the current delivery path for HLS until the native layer is selected.

## Consequences

- The portable bundle must ship `libmpv-2.dll`; the release workflow downloads the current mpv-dev build and `scripts/package_portable.py` places the DLL beside the executable.
- FFI unsoundness is confined to one module; commands only see safe methods. Clippy type-checks every target, and `test_player` exercises the safe facade when `libmpv-2.dll` is available (it is not part of the hermetic CI suite).
- The current Player overlay does not call `player_init`; it plays HLS through hls.js in a `<video>` element and applies Anime4K through `anime4k-webgpu`. The native command surface and FFI layer are therefore not on the active playback path today. [docs/architecture.md](../architecture.md) records this as the current state; any change that wires the native backend in must update that overview and this ADR together.
