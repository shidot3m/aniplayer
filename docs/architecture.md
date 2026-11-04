# Architecture overview

Date: 2026-11-02

Aniplayer is a Tauri 2 desktop app: a React WebView for the interface, a Rust backend for catalog access, local storage, downloads, and the mpv player it supervises, and a portable folder that carries every runtime asset. This document maps the current code; when it and the code disagree, the code wins and this document is a defect. See [GLOSSARY.md](../GLOSSARY.md) for the domain vocabulary and [docs/adr/](adr/) for the decisions behind the shape.

## System shape

```mermaid
flowchart LR
    subgraph WebView["WebView UI (React 19)"]
        Shell["App shell"]
        Features["Feature slices"]
        Stores["Zustand stores"]
    end

    subgraph Rust["Rust backend (Tauri 2)"]
        Commands["IPC commands"]
        ApiClient["AnilibriaClient"]
        Database[("SQLite<br/>data/aniplayer.db")]
        HlsDownloader["HLS downloader"]
        Supervisor["mpv supervisor<br/>(JSON IPC over a pipe)"]
    end

    Mpv["mpv.exe<br/>(bundled child process)"]
    AniLiberty["AniLiberty API and CDN"]
    Disk[("Portable folder<br/>data/ + downloads/ + mpv/ + shaders/")]

    Features -->|invoke| Commands
    Commands --> ApiClient --> AniLiberty
    Commands --> Database --> Disk
    Commands --> HlsDownloader --> Disk
    Supervisor -->|"spawn, --wid, pipe"| Mpv
    Mpv -->|"HLS / local files"| AniLiberty
    Mpv --> Disk
    Commands -.->|"download-progress, player-event"| Stores
```

Two facts that shape the rest of this document:

- Catalog calls go through the Rust client first and fall back to direct HTTP. Video bytes never travel through the WebView: mpv fetches HLS from the CDN or reads downloaded files itself.
- **mpv is the only playback backend** ([ADR 0010](adr/0010-mpv-subprocess-as-the-only-playback-backend.md)). The `<video>` element is not a player; the WebView draws only the control overlay. The Rust backend never decodes or rewrites media — the bundled `mpv/mpv.exe` child process does, and the app talks to it over JSON IPC on a named pipe.

## Layers and ownership

### WebView UI

- Entry point: `index.html` → `src/main.tsx`.
- Application shell: `src/app/App.tsx` and `src/app/Header.tsx`. The shell only composes features: screen selection, store lifecycle effects, and shell chrome. Feature-specific markup lives inside the owning feature.
- Feature slices under `src/features/`: `catalog`, `release`, `continue-watching`, `player`, `downloads`, `bookmarks`, `settings`. Each slice owns the UI, hooks, and state it needs, and exposes a public surface through its `index.ts`; not every slice has all three.
- Shared layer: `src/shared/types` (API and domain types), `src/shared/ui` (Radix-based primitives), `src/shared/lib` (API base URLs and release helpers).
- State is client-side and optimistic: `catalogStore` holds catalog screens, cached Releases, bookmarks, and history; `playerStore` holds playback state and Settings and drives mpv through the `player_*` commands; `downloadStore` holds downloads and subscribes to backend events.
- The UI also runs in a plain browser (`bun run dev` without Tauri) for catalog work. In that mode catalog calls fall back to direct `fetch`, bookmarks and settings fall back to browser storage, and downloads are unavailable.

Boundary rule, enforced by `tests/test_feature_boundaries.test.ts`:

- A feature may import its own internals, the shared layer, and other features only through `@/features/<name>` (the barrel).
- Importing another feature's internals (`@/features/<name>/ui/...`) is a test failure.
- Code outside `src/features` reaches features only through their barrels.

### IPC boundary

The WebView reaches Rust through `invoke` from `@tauri-apps/api/core`. Commands are grouped by domain in `src-tauri/src/commands/` and registered in one `generate_handler!` list in `src-tauri/src/lib.rs`.

| Command family  | Commands                                                                                       | Rust service                                 |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `api_*`         | status, latest releases, schedule, genres, genre releases, release details, franchises, search | `AnilibriaClient` (`src-tauri/src/api`)      |
| `db_*`          | bookmarks, history, continue watching, settings, download metadata, downloaded-episode index   | `Database` (`src-tauri/src/db`)              |
| `downloader_*`  | HLS episode/release download, cancel, delete, open folder                                      | `HlsDownloader` (`src-tauri/src/downloader`) |
| `player_*`      | open, close, set_pause, seek, set_volume, set_speed, set_anime4k                               | `MpvSupervisor` (`src-tauri/src/player`)     |
| `app_*`, `ping` | ping, fullscreen                                                                               | Tauri window                                 |

Backend events are one-way, Rust → WebView:

- `download-progress` — per-episode HLS progress: segment counts, bytes transferred, mean throughput, percentage, status and error. A COMPLETED line makes `downloadStore` reload the downloaded-episode index, and a CANCELLED one drops the task from the queue.
- `player-event` — mpv playback updates translated from JSON IPC: `time` (position + duration), `ended`, `fault`, `hardwareDecoder`; `useNativePlayer` feeds them into `playerStore`.

### Rust services

`startup::bootstrap` is the composition root. It resolves the application directory, opens the database, drops the Downloaded episodes an older build indexed from torrent payloads, creates the HLS downloader, and builds `AppState`; each fallible step fails with an actionable `StartupError` that is shown in a native dialog. Nothing half-started is left behind.

`AppState` holds `Arc`s to the database, API client, HLS downloader, the mpv supervisor, and the application directory. The builder registers a window-event hook that keeps the video window glued to the main window and stops mpv when the main window closes.

| Module                    | Responsibility                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api/`                    | `reqwest` client for AniLiberty endpoints, response models, URL encoding.                                                                                                                                                                                                                                                                                                      |
| `commands/`               | Thin IPC adapters: validation, locking, delegation, event emission. No business logic beyond argument shaping.                                                                                                                                                                                                                                                                 |
| `db/`                     | `Database` (one `Mutex<Connection>`), schema creation, repository methods, row models.                                                                                                                                                                                                                                                                                         |
| `downloader/hls.rs`       | Fetches m3u8 playlists, segments, init and key resources, writes files, tracks cancel flags, persists status and Skip timecodes, emits progress with bytes and throughput.                                                                                                                                                                                                     |
| `player/`                 | The mpv lifecycle: `supervisor.rs` spawns and owns the child, attaches it to the `native-player` window, and validates sources; `ipc.rs` carries commands to the pipe on a writer thread, judges whether mpv is still answering them, and watches for the wedge; `events.rs` turns mpv property events into `player-event`s; `shaders.rs` maps Anime4K presets to GLSL chains. |
| `startup.rs` / `state.rs` | Bootstrap, path resolution, the legacy-download purge, fatal-error reporting, and the managed application state.                                                                                                                                                                                                                                                               |

## Data flows

### Catalog and library

1. `App` mounts and calls `catalogStore.loadInitialData()`: `api_get_latest_releases` and `db_get_all_history`, then bookmarks and genres.
2. Search, genre pagination, release details, and franchises call the matching `api_*` command. If the command fails, the store falls back to a direct `fetch` against the same AniLiberty base URL; in a plain browser the fallback is the only path.
3. Release details are cached in the store and in browser storage; a bookmark stores a JSON snapshot of the Release.
4. Bookmarks and watch progress are optimistic in the store and persisted through `db_save_bookmark` / `db_save_history`. Watch progress is saved at most every 4 seconds while playing and on pause/unmount; an Episode becomes completed at 90% of its duration.

### Online playback (current Player overlay)

1. `playerStore.openPlayer` receives a Release and an Episode. If the Episode has no HLS URLs, it loads full Release details through `api_get_release`.
2. `App` renders `LazyPlayerOverlay` inside `Suspense`; the overlay owns no video element.
3. `playerStore` invokes `player_open` with the selected Quality's HLS URL plus the start position, volume, speed and Anime4K choice. `MpvSupervisor` creates (or reuses) the `native-player` window, spawns the bundled mpv with `--wid` attached to it and `--network-timeout=10` — AniLiberty redirects every segment to a rotating host, so a dead edge must cost one bounded wait, not the sixty-second default ([#45](https://github.com/shidot3m/aniplayer/issues/45)) — connects the JSON IPC pipe, and sends `loadfile`. The two windows are then stacked together by `stack_player_windows`: both join the topmost band, with the main window moved last so it ends up above the video window — a plain top-level video window loses to any window the user activates, and one activated window then sat between the frame and the transparent hole the main window leaves for it ([#49](https://github.com/shidot3m/aniplayer/issues/49)).
4. `useNativePlayer` subscribes to `player-event`; each `time` event drives `playerStore.updateTime`, which in turn drives auto-skip of opening/ending timecodes, autoplay of the next Episode, and persistence of watch progress. Controls invoke `player_set_pause`, `player_seek`, `player_set_volume`, `player_set_speed`; a `fault` ends the native session through `playerStore.reportFault` and shows the reason. Every `player_*` command is dispatched off the main thread, because it waits on the session mutex that `player_open` holds while it asks the main thread to move and show the video window, and it only reaches the command queue — the pipe itself belongs to the writer thread.
5. Subtitles are mpv's too: `--slang=en,ru` picks the preferred embedded track; the app exposes no track menu of its own.
6. Anime4K is mpv's GLSL chain: `player_set_anime4k` sends `change-list glsl-shaders` with the preset's `;`-separated shader paths from `shaders/anime4k/`.

### Offline playback

1. `DownloadsView` reads the downloaded-episode index through `db_get_all_downloaded_episodes`.
2. The stored `file_path` — an Offline playlist `index.m3u8`, or the single file a pre-playlist layout left behind — goes to `player_open` unchanged. `validated_source` canonicalizes it and refuses anything outside the app's `downloads/` folder; mpv then demuxes the local playlist, resolving segment, `#EXT-X-MAP` init and `#EXT-X-KEY` URIs against the folder on disk.
3. Seeking, Quality, Skip timecodes and Watch progress are the same IPC calls as online playback; container and codec no longer matter to the app.

### Native playback session

1. One mpv child serves the whole player. `player_open` on an existing session sends a new `loadfile` (quality switches and episode switches reuse the process); the pipe, the writer thread, the reader thread, the watchdog and the window stay.
2. `playerStore` owns that lifetime, not the view: `openPlayer` starts the session, `closePlayer` ends it, and a `fault` from mpv ends it through `reportFault` while the overlay stays mounted to show the reason. Mounting and unmounting `PlayerOverlay` never closes it — React remounts every component in development, and a teardown keyed to the view's unmount stopped the mpv the next mount was already playing into ([#48](https://github.com/shidot3m/aniplayer/issues/48)). Unmount still saves watch progress.
3. Waiting for the pipe watches mpv itself: a child that stops before the pipe exists is reported with the code it stopped on, a close that reclaims the kill handle first is reported as the player being closed, and only a child still held by the supervisor when the budget ends is a connection timeout. Windows hands exit code 1 to every process `Child::kill` terminates, so a status read back after our own kill says nothing about mpv, and the supervisor never reports one as mpv's death ([#48](https://github.com/shidot3m/aniplayer/issues/48)).
4. Commands reach mpv through a queue that one writer thread drains, so no `player_*` call ever waits on the pipe: a write mpv never reads — the wedge in [#43](https://github.com/shidot3m/aniplayer/issues/43) — parks that thread alone. Every command carries a `request_id`, the reader thread marks the moment any line comes back, and a command left unanswered while the pipe has been silent is reported as a `fault`, after which the watchdog kills mpv (which releases the parked write) and stops. The silence budget is phase-aware ([#45](https://github.com/shidot3m/aniplayer/issues/45)): opening a file holds mpv's core inside the network — the pipe answers nothing and shows nothing — so from each `loadfile` write until playback reports its first position the player gets the load budget (30 s, sized around mpv's own bounded network waits); once a position has arrived, an unanswered command is wedged after the interactive 5 s. Quality and episode switches send a new `loadfile` and re-enter the load phase.
5. The reader thread translates mpv JSON lines into `player-event`s. If mpv dies or the pipe breaks, it emits `fault` and the frontend closes the player — the app itself never goes down with the child.
6. `MpvSession::drop` kills mpv, waits for it, and closes the video window; the main window loses its always-on-top flag. Closing the main window triggers the same stop through the window-event hook. That hook never waits on the session mutex (`player_open` holds it across window calls only the event loop services): it stops mpv through a child handle parked beside the mutex and reclaims the session with `try_lock`, handing the wait to a worker when a startup is in flight ([#44](https://github.com/shidot3m/aniplayer/issues/44)).
7. Every command argument is built as a structured JSON value or an argv entry; no path is interpolated into a shell string, and the pipe name is per-process and per-session.

### HLS download

1. A release or episode action sends one `DownloadEpisodeItem` per episode to `downloader_start_episode` or `downloader_start_release`.
2. The command spawns a Tokio task; `HlsDownloader::download_episode` records a DOWNLOADING row with the Skip timecodes, then fetches the playlist.
3. `prepare_local_playlist` resolves the segment URIs against the playlist URL and rewrites the URI lines to `segment-NNNNN.ts`, preserving `#EXTINF` and the other tags and closing the playlist with `#EXT-X-ENDLIST`. `#EXT-X-MAP` init segments and `#EXT-X-KEY` keys are downloaded beside the playlist and rewritten to local names, because mpv replays the folder from disk; only master (`#EXT-X-STREAM-INF`) and byte-range (`#EXT-X-BYTERANGE`) playlists are rejected.
4. Segments are written to `downloads/<release_id>/<ordinal>/`, then the playlist is written as `index.m3u8`. The row is updated to COMPLETED with the size of segments plus playlist. Failures remove the folder and become FAILED; cancellation deletes the folder and the row.
5. Progress is emitted as `download-progress` per segment — bytes written so far, mean throughput, percentage from the segment count — and consumed by `downloadStore` and the floating widget; completion triggers a reload of the downloaded-episode index. This is the only way an Episode reaches the device ([ADR 0013](adr/0013-hls-only-delivery-drops-bittorrent.md)).

### Settings

`playerStore.initSettings` reads persisted Settings through `db_get_setting`. Volume, preferred Quality, Anime4K preset, Anime4K enabled, and hotkeys are written through `db_save_setting`. Auto-skip and autoplay toggles currently live only in the session state.

## Runtime asset layout

Portable bundle (the only distributed artifact):

```text
Aniplayer/
├─ aniplayer.exe
├─ mpv/
│  ├─ mpv.exe                             # pinned playback runtime
│  └─ *.dll                               # its FFmpeg/render libraries
├─ shaders/
│  └─ anime4k/*.glsl                      # Anime4K shader chain
├─ data/
│  └─ aniplayer.db
└─ downloads/
   ├─ <release_id>/
   │  └─ <ordinal>/
   │     ├─ index.m3u8                    # local HLS playlist
   │     ├─ segment-NNNNN.ts              # HLS segments
   │     ├─ init-NNNNN.mp4                # #EXT-X-MAP init segments
   │     └─ key-NNNNN.key                 # #EXT-X-KEY keys
   └─ torrents/                           # what an older build left; nothing here is listed or played
```

All paths are relative to the executable's directory (`startup::app_dir`). `mpv/` and `shaders/` are staged by `scripts/get_mpv.py` and `scripts/package_portable.py`; the release workflow verifies the mpv archive's SHA-256 pin and the archive check asserts both directories are present.

`scripts/get_libmpv.py` stages the pinned in-process runtime (`libmpv-2.dll` plus its `LICENSE.*`/`NOTICE.md`) into a folder of the caller's choosing and caches it under `.cache/libmpv-<pin>/`. Nothing loads it yet: playback still goes through the `mpv/` child process, and the DLL arrives with the in-process backend ([#56](https://github.com/shidot3m/aniplayer/issues/56), [#57](https://github.com/shidot3m/aniplayer/issues/57)) — the source, pin and license are decided in [ADR 0012](adr/0012-libmpv-runtime-is-a-pinned-mirrored-lgpl-build.md), with the HEVC Main 10 gate recorded in [`docs/evidence/54/`](evidence/54/).

## Persistence

`data/aniplayer.db` is the local-first store (see [ADR 0004](adr/0004-sqlite-local-first-store.md)):

- `bookmarks` — Release id, category, JSON snapshot, timestamps.
- `history` — (Release, Episode) playback position, duration, completion flag, timestamp.
- `downloaded_episodes` — file path, size, Quality, Skip timecodes, Download status.
- `app_settings` — string key/value pairs.

There is no migration framework: the initializer creates missing tables only. Changing an existing table requires an explicit migration and a test.

One data cleanup runs outside the schema, in `startup::purge_legacy_torrent_downloads`: the Downloaded episodes an older build indexed from torrent payloads carry the `torrent-` id prefix, and they leave `downloaded_episodes` on every launch. It is one indexed `DELETE`, so it needs no version marker, and it never touches a file — the media an old build downloaded stays on disk and simply stops being listed.

## Security boundaries

- The production CSP is restrictive and is contract-tested in `src-tauri/tests/test_security_config.rs`. The development CSP relaxes only the Vite dev server (`script-src` inline, local HMR socket). `media-src` is `'none'` and the asset protocol is disabled: the WebView loads no media at all, so there is no media surface on the web side to guard.
- `player_open` validates its source in Rust: `http(s)` URLs are re-parsed and re-serialized, local paths must canonicalize inside the app's `downloads/` folder and be a file. The frontend never names a pipe, a window, or an executable path.
- The mpv child runs with `--no-config`, no input bindings, no script paths, and an argv built in code; the JSON IPC pipe is private to the process.
- The capability file grants `core:default` and `core:window:default` and nothing else: the page opens no URL and no path in the operating system. Revealing a downloads folder is a Rust-side call (`downloader_open_folder`), so it needs no webview permission. The guard test fails if an `opener:` or `shell:` permission, or a `magnet` scope, reappears.
- The app binds no listening socket and joins no peer network. Outbound HTTP to the AniLiberty API and CDN is the whole surface ([ADR 0013](adr/0013-hls-only-delivery-drops-bittorrent.md)).

## Current state and tracked gaps

- **Quality switching reloads through mpv.** `setQuality` sends a new `loadfile` at the current position; the switch is not gapless.
- **mpv's stall on a struggling HLS stream is not reproduced by a flag change.** Measured on the stream [#43](https://github.com/shidot3m/aniplayer/issues/43) was filed from (AniLiberty release 10172, HLS 720p, bundled mpv v0.41.0, the app's own arguments): every segment fails the demuxer's keepalive and is refetched on a fresh connection — 51 `keepalive request failed` and 51 `Cannot reuse HTTP connection` warnings in 120 s of uninterrupted playback. `--demuxer-lavf-o=http_persistent=0` silences both warnings but ends the stream after 33–43 s with `tls: Unable to read from socket`, so it was rejected; the spawn keeps mpv's defaults and the player is instead hardened against the wedge. The trigger of the rare stall itself remains unconfirmed.

## Verification gates

- Frontend: `bun run typecheck`, `bun run lint` (Biome), `bun run test` (Vitest), `bunx aislop ci`, `bun run build`.
- JS toolchain: Bun only ([ADR 0011](adr/0011-bun-as-the-js-toolchain.md)) — a CI guard step fails when an npm/npx reference appears in `.github/workflows/` or `scripts/`.
- Rust: `cargo fmt --check`, `cargo clippy --all-targets --locked -- -D warnings`, `cargo audit`, and the hermetic test suites listed in `.github/workflows/ci.yml` — including `test_player`, which exercises the mpv event translation and the Anime4K preset chains, `test_player_ipc`, which exercises the command queue, the stall judgement and the watchdog, and `test_startup`, which also proves the legacy purge drops torrent rows idempotently and leaves HLS rows and disk files alone.
- Packaging: the release workflow pins the mpv build by SHA-256 in `scripts/get_mpv.py`, and the archive check asserts `mpv/mpv.exe` and the Anime4K shaders are inside `Aniplayer-portable.zip`.
- Feature boundaries, bundle budgets, CSP parity, the playback-source confinement, and the closed capability surface are enforced by tests, not by convention alone.
