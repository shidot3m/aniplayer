# 10. mpv as a supervised subprocess is the only playback backend

Date: 2026-11-02

Status: accepted

Supersedes: [ADR 0007](0007-remove-native-libmpv-layer.md) (its WebView-only rule), the playback-gate and remux parts of [ADR 0009](0009-matroska-remux-and-codec-probe.md), the `#EXT-X-MAP` / `#EXT-X-KEY` rejections and the hls.js dependency of [ADR 0008](0008-local-hls-offline-downloads.md), and the distribution sentence of [ADR 0006](0006-portable-only-distribution.md) that said the archive carries no native media runtime.

## Context

The WebView stack could never play everything the catalog ships. Measured on the development machine, which has no HEVC decoder installed: `canPlayType` answers `""` for `hvc1 Main10` and `mediaCapabilities` answers `false`, while AV1, VP9, Opus and AAC all answer `probably` / supported. HEVC (the compact AniLiberty releases) and the exotic audio codecs were simply undecodable, and ADR 0009's answer — a pure-Rust remux plus a probe that refuses the episode — only moved the failure into an explanation screen.

The official `mpv-v0.41.0-x86_64-w64-mingw32` build decodes the same HEVC Main 10 fixture on the same machine (`VO: [null] 128x96 yuv420p10`) and plays VP9 and Opus to end of file. It ships **no `libmpv-2.dll`** — only `mpv.exe` and its FFmpeg DLLs — so an in-process FFI is not available from this build. ADR 0007 anticipated exactly this: restoring native playback required "a new FFI _or_ process-isolation design". Process isolation is the design here, and it also keeps the Rust backend free of `unsafe` and confines an mpv fault to the player window.

The project has been here before and turned back: `0bd8fa6` landed a libmpv FFI core that never had a caller, and `b05f132` deleted ~18.7k lines of it. The lesson recorded in [#41](https://github.com/shidot3m/aniplayer/issues/41) is that the wiring is the first deliverable — this ADR lands with the overlay driving mpv, not ahead of it.

## Decision

- **One backend for every source.** Online HLS, offline playlists, downloaded files and torrents all play through a bundled mpv. The `<video>` element stops being a player: `hls.js`, Media Source Extensions, the `anime4k-webgpu` canvas, the Matroska remux (`remux/` and its range protocol) and the codec-capability probe as a playback gate are deleted in the same pass. No dormant second stack remains.
- **A separate process with JSON IPC.** `MpvSupervisor` (`src-tauri/src/player/supervisor.rs`) spawns the pinned `mpv/mpv.exe` beside the executable with `--wid` (a dedicated borderless `native-player` window kept in sync with the main window's bounds), `--vo=gpu-next`, `--hwdec=auto-safe`, `--input-ipc-server=\\.\pipe\...`, and no config or input bindings. The frontend never sees the pipe; commands go through `player_*` IPC, and mpv property events (`time-pos`, `duration`, `hwdec-current`, `end-file`) reach the UI as a `player-event` Tauri event.
- **The app owns the child.** The supervisor kills mpv on session drop, closes the player on an mpv fault instead of taking the app down, and stops on the main window's close/destroy. Argument vectors are built in code; no path is interpolated into a shell string.
- **Compositing via window stacking.** WebView2 cannot host an foreign HWND child inside the web content, so mpv renders into its own top-level window and the main window — transparent (`transparent: true`, `backgroundColor: #00000000`, `noRedirectionBitmap`) — is set always-on-top while the player is open. The React overlay draws the controls over the video; the video rectangle itself is a click target, not a `<video>`.
- **Sources are validated in the backend.** `player_open` accepts only `http(s)` URLs or canonical paths inside the app's `downloads/` folder; anything else is refused before mpv is touched ([#41](https://github.com/shidot3m/aniplayer/issues/41) criteria: offline playlists, downloaded files, HLS URLs).
- **Anime4K returns to the GLSL chain.** Presets are `;`-separated shader paths under `shaders/anime4k/` beside the executable, applied with `change-list glsl-shaders`; the setting persists as before.
- **Hardware decode is informational.** `hwdec=auto-safe` uses hardware when present and falls back to software; the `hwdec-current` event feeds the 4K warning. Codec verdicts no longer gate anything — with mpv there is no "this machine cannot decode it".
- **The mpv runtime ships in the portable archive.** The release workflow downloads the pinned build (version + SHA-256 in `scripts/get_mpv.py`), and `scripts/package_portable.py` copies the runtime to `mpv/` and the shaders to `shaders/` beside `aniplayer.exe`; the archive check asserts both are present.

## Considered options

- **Keep the WebView as the easy path and use mpv only where it fails** — rejected: two playback stacks is the exact situation ADR 0007 deleted 18.7k lines to end; the split would double the testing surface for every control.
- **libmpv FFI in-process** — rejected: the pinned official build carries no `libmpv-2.dll`, and an in-process decoder puts `unsafe` and crash risk into the app process.
- **`--wid` into the main window's HWND directly** — rejected: WebView2 is a child window of the same HWND and paints over it; a separate always-on-top transparent main window is the arrangement that keeps the React overlay on the video.
- **mpv-owned window with the overlay moved into mpv's OSC** — rejected: it would discard the existing controls, hotkeys, skip toasts and watch-progress UI.

## Consequences

- Any Windows PC plays any episode — HEVC Main 10, AV1, VP9, Opus, DTS/AC3, MPEG-2/VC-1, any container ffmpeg reads — with nothing installed by the user. The system codec packs stop mattering.
- The portable archive grows by the mpv runtime (~100 MB unpacked); "executable plus empty data folder" becomes "executable plus its media runtime plus an empty data folder" ([ADR 0006](0006-portable-only-distribution.md) amended).
- Offline downloads can now store fragmented-MP4 and encrypted HLS: the downloader localizes `#EXT-X-MAP` and `#EXT-X-KEY` resources beside the playlist instead of refusing them, and mpv replays the folder from disk ([ADR 0008](0008-local-hls-offline-downloads.md) amended).
- Bundle budget changes: `hls.js` (~a third of the lazy chunk) leaves the frontend graph ([ADR 0002](0002-bundle-budget-and-code-splitting.md)).
- Torrent payloads no longer need classification: every file ffmpeg can demux is indexed and played; the unsupported-files reporting and `downloader_prepare_stream` are gone ([ADR 0009](0009-matroska-remux-and-codec-probe.md) superseded for playback).
- Runtime behavior now depends on a shipped third-party binary: an mpv version bump is a code-plus-packaging change, pinned by digest in `scripts/get_mpv.py`, and its fault model is "the player closes", handled by `player-event` `fault`.
- The guard test that asserted the app has _no_ native backend is replaced by behavioural tests over the IPC boundary; an assertion about which backend exists is always on the wrong side of the next decision.
