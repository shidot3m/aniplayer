# Architecture overview

Date: 2026-11-02

Aniplayer is a Tauri 2 desktop app: a React WebView for the interface and playback, a Rust backend for catalog access, local storage, and downloads, and a portable folder that carries every runtime asset. This document maps the current code; when it and the code disagree, the code wins and this document is a defect. See [GLOSSARY.md](../GLOSSARY.md) for the domain vocabulary and [docs/adr/](adr/) for the decisions behind the shape.

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
        TorrentEngine["Torrent engine<br/>(librqbit)"]
        Scanner["Torrent episode scanner"]
        Remux["Remux service<br/>(EBML reader, MP4 writer)"]
    end

    AniLiberty["AniLiberty API and CDN"]
    Disk[("Portable folder<br/>data/ + downloads/")]

    Features -->|invoke| Commands
    Commands --> ApiClient --> AniLiberty
    Commands --> Database --> Disk
    Commands --> HlsDownloader --> Disk
    Commands --> TorrentEngine --> Disk
    TorrentEngine --> Scanner --> Database
    Commands --> Remux --> Disk
    Features -->|"video: hls.js or asset protocol"| AniLiberty
    Features -->|"video: hls.js or asset protocol"| Disk
    Features -->|"video: remux protocol"| Remux
    Commands -.->|"download-progress, downloads-updated"| Stores
```

Two facts that shape the rest of this document:

- Catalog calls go through the Rust client first and fall back to direct HTTP; online playback always travels directly from the WebView to the AniLiberty CDN. Local files travel through Tauri's asset protocol, and a remuxed torrent episode through the `remux` protocol.
- Playback happens entirely in the WebView: a `<video>` element driven by hls.js for online HLS and for Offline playlists, the same element fed directly by the asset protocol for downloaded files, and Anime4K enhancement on a WebGPU canvas. The Rust backend never decodes video — it only rewrites a container so the WebView can decode it, a stream copy under [ADR 0009](adr/0009-matroska-remux-and-codec-probe.md).

## Layers and ownership

### WebView UI

- Entry point: `index.html` → `src/main.tsx`.
- Application shell: `src/app/App.tsx` and `src/app/Header.tsx`. The shell only composes features: screen selection, store lifecycle effects, and shell chrome. Feature-specific markup lives inside the owning feature.
- Feature slices under `src/features/`: `catalog`, `release`, `continue-watching`, `player`, `downloads`, `bookmarks`, `settings`. Each slice owns the UI, hooks, and state it needs, and exposes a public surface through its `index.ts`; not every slice has all three.
- Shared layer: `src/shared/types` (API and domain types), `src/shared/ui` (Radix-based primitives), `src/shared/lib` (API base URLs and release helpers).
- State is client-side and optimistic: `catalogStore` holds catalog screens, cached Releases, bookmarks, and history; `playerStore` holds playback state and Settings; `downloadStore` holds downloads and subscribes to backend events; `codecCapabilityStore` holds the startup Codec capability probe and reports it to Rust once.
- The UI also runs in a plain browser (`npm run dev` without Tauri) for catalog work. In that mode catalog calls fall back to direct `fetch`, bookmarks and settings fall back to browser storage, and downloads are unavailable.

Boundary rule, enforced by `tests/test_feature_boundaries.test.ts`:

- A feature may import its own internals, the shared layer, and other features only through `@/features/<name>` (the barrel).
- Importing another feature's internals (`@/features/<name>/ui/...`) is a test failure.
- Code outside `src/features` reaches features only through their barrels.

### IPC boundary

The WebView reaches Rust through `invoke` from `@tauri-apps/api/core`. Commands are grouped by domain in `src-tauri/src/commands/` and registered in one `generate_handler!` list in `src-tauri/src/lib.rs`.

| Command family  | Commands                                                                                                                                                                                    | Rust service                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `api_*`         | status, latest releases, schedule, genres, genre releases, release details, torrents, franchises, search                                                                                    | `AnilibriaClient` (`src-tauri/src/api`)                               |
| `db_*`          | bookmarks, history, continue watching, settings, download metadata, downloaded-episode index                                                                                                | `Database` (`src-tauri/src/db`)                                       |
| `downloader_*`  | HLS episode/release download, cancel, delete, open folder, unsupported torrent file listing, torrent file download, magnet opening, embedded torrent start/cancel, remux stream preparation | `HlsDownloader`, `TorrentDownloader`, `TorrentEngine`, `RemuxService` |
| `app_*`, `ping` | ping, fullscreen, codec capability report                                                                                                                                                   | Tauri window, `CodecCapabilities`                                     |

Backend events are one-way, Rust → WebView:

- `download-progress` — per-episode HLS progress and per-torrent progress; `downloadStore` normalizes both shapes.
- `downloads-updated` — emitted after torrent scanning, and after a codec report rescans the downloaded library; the store reloads the downloaded-episode index.

### Rust services

`startup::bootstrap` is the composition root. It resolves the application directory, opens the database, creates the HLS downloader and the torrent engine, and builds `AppState`; each fallible step fails with an actionable `StartupError` that is shown in a native dialog. Nothing half-started is left behind.

`AppState` holds `Arc`s to the database, API client, HLS downloader, torrent file downloader, torrent engine, the codec verdicts the WebView reported, the prepared remux streams, and the application directory. The `remux` URI scheme protocol is registered on the same builder and answers from the prepared streams.

| Module                         | Responsibility                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`                         | `reqwest` client for AniLiberty endpoints, response models, URL encoding.                                                                             |
| `codec.rs`                     | Codec families the app asks about, the WebView's verdicts, the container-to-family mapping, and the shared capability state.                          |
| `commands/`                    | Thin IPC adapters: validation, locking, delegation, event emission. No business logic beyond argument shaping.                                        |
| `db/`                          | `Database` (one `Mutex<Connection>`), schema creation, repository methods, row models.                                                                |
| `downloader/hls.rs`            | Fetches m3u8 playlists and segments, writes files, tracks cancel flags, persists status and Skip timecodes, emits progress.                           |
| `downloader/torrent.rs`        | Torrent-file download from the API, magnet and path validation, opening through the OS handler.                                                       |
| `downloader/torrent_engine.rs` | Long-lived `librqbit` session, torrent tracking tasks, progress sampling, completion hook.                                                            |
| `downloader/scanner.rs`        | Extracts Ordinals, classifies each file as native, remuxable, or blocked, indexes the first two, and reports the rest with the reason it was skipped. |
| `remux/`                       | EBML reader for Matroska, ISO BMFF writer for MP4, the byte-range `Plan` a remuxed episode plays from, and its token cache and protocol responder.    |
| `startup.rs` / `state.rs`      | Bootstrap, path resolution, fatal-error reporting, and the managed application state.                                                                 |

## Data flows

### Catalog and library

1. `App` mounts and calls `catalogStore.loadInitialData()`: `api_get_latest_releases` and `db_get_all_history`, then bookmarks and genres.
2. Search, genre pagination, release details, torrents, and franchises call the matching `api_*` command. If the command fails, the store falls back to a direct `fetch` against the same AniLiberty base URL; in a plain browser the fallback is the only path.
3. Release details are cached in the store and in browser storage; a bookmark stores a JSON snapshot of the Release.
4. Bookmarks and watch progress are optimistic in the store and persisted through `db_save_bookmark` / `db_save_history`. Watch progress is saved at most every 4 seconds while playing and on pause/unmount; an Episode becomes completed at 90% of its duration.

### Online playback (current Player overlay)

1. `playerStore.openPlayer` receives a Release and an Episode. If the Episode has no HLS URLs, it loads full Release details through `api_get_release`.
2. `App` renders `LazyPlayerOverlay` inside `Suspense`; this is the only entry that pulls in hls.js and Anime4K WebGPU.
3. `usePlayerControllers` selects the HLS URL for the active Quality and `useHlsVideo` attaches it to a `<video>` element through hls.js. A local asset URL ending in `.m3u8` also goes through hls.js; other local asset URLs are loaded directly.
4. Time updates drive auto-skip of opening/ending timecodes, autoplay of the next Episode, and persistence of watch progress.
5. When Anime4K is enabled, `Anime4kCanvas` dynamic-imports `anime4kRenderer` and renders the enhanced frame on a canvas over the `<video>` element. The renderer is the only code that imports `anime4k-webgpu`.

### Offline playback

1. `DownloadsView` reads the downloaded-episode index through `db_get_all_downloaded_episodes` and the skipped torrent files through `downloader_list_unsupported_files`, each with its own reason.
2. It turns the stored path into a stream with `offlineStreamUrl`: an Offline playlist or a native file goes through Tauri's `convertFileSrc` and becomes an asset-protocol URL, and for a playlist the percent-encoded backslashes become forward slashes, so hls.js resolves the segment names inside the episode folder instead of the protocol root. A Matroska episode instead calls `downloader_prepare_stream`, which builds the plan and answers with a token URL on the `remux` protocol.
3. An HLS download stores `<release_id>/<ordinal>/index.m3u8`; `useHlsVideo` sees the playlist extension and hands the asset URL to hls.js, which fetches the local TS segments and demuxes them into Media Source Extensions. Anything else — a `.mp4`, a `.webm`, or a `remux` URL — is a plain `src` on the same `<video>` element, and seeking, Quality, Skip timecodes and Watch progress work the same way for all of them.
4. A file the app cannot deliver is never in that list: it stays on disk and appears under its release as an Unsupported torrent file, with the reason — the container this app cannot remux, or the codec this machine cannot decode — and the way out for each.

### HLS download

1. A release or episode action sends one `DownloadEpisodeItem` per episode to `downloader_start_episode` or `downloader_start_release`.
2. The command spawns a Tokio task; `HlsDownloader::download_episode` records a DOWNLOADING row with the Skip timecodes, then fetches the playlist.
3. `prepare_local_playlist` resolves the segment URIs against the playlist URL and rewrites the URI lines to `segment-NNNNN.ts`, preserving `#EXTINF` and the other tags and closing the playlist with `#EXT-X-ENDLIST`. Playlists that cannot be replayed offline are rejected: fragmented (`#EXT-X-MAP`), encrypted (`#EXT-X-KEY`), master (`#EXT-X-STREAM-INF`), and byte-range (`#EXT-X-BYTERANGE`).
4. Segments are written to `downloads/<release_id>/<ordinal>/`, then the playlist is written as `index.m3u8`. The row is updated to COMPLETED with the size of segments plus playlist. Failures remove the folder and become FAILED; cancellation deletes the folder and the row.
5. Progress is emitted as `download-progress` and consumed by `downloadStore`; completion triggers a reload of the downloaded-episode index.

### Torrent download

1. `downloadStore.startTorrentDownload` calls `downloader_start_torrent` with a magnet or URL.
2. `TorrentEngine` adds the torrent to the shared `librqbit` session with an output folder of `downloads/torrents/<release_id>/`.
3. A tracking task samples statistics every 500 ms and emits `download-progress`.
4. On completion the scanner walks the folder, extracts Ordinals, and classifies every video against the Codec capability probe: files that play natively or through the remux become `downloaded_episodes` rows, and the rest stay on disk until `scan_unsupported_torrent_files` reports them with a reason. `downloads-updated` then makes the UI reload the index, and the episodes become playable offline.

### Startup codec probe

1. `App.tsx` calls `codecCapabilityStore.probe()` when it mounts. The probe asks one question per codec family — `video.canPlayType` first, `navigator.mediaCapabilities.decodingInfo` for a file when the container answer is only `maybe`, and `MediaSource.isTypeSupported` as a negative check — and records `decodable`, `undecodable`, or `unknown`.
2. The report goes to `app_report_codec_capability`, which stores it in `AppState.codec_caps`, rescans the downloaded library against it, and emits `downloads-updated`. A decoder installed or removed since the last run therefore changes what is offered, and an episode nobody can decode is not left in the library to open on a black frame.
3. `TorrentsTab` reads the same report through the player barrel to decide which torrent to recommend: an advertised codec this machine cannot decode is named as such on its card, and the HEVC affordances go quiet until the probe has answered.

### Remuxed playback

1. Opening a Matroska episode calls `downloader_prepare_stream`, which confines the path to `downloads/torrents/`, reads the container header, and builds a `Plan`: the MP4 sample tables plus a map from each virtual byte range to an offset in the source file.
2. Frames are copied, never re-encoded. Matroska stores AVC and HEVC with the same length-prefixed framing MP4 uses, so one block becomes one sample byte for byte; `avcC`/`hvcC`/`esds` records move over as they are, and AAC keeps its priming frame skipped by an edit list.
3. The plan is cached under a token (a four-entry LRU, kept warm by its own traffic) and the token URL goes into `<video src>`. The `remux` protocol answers `Range` requests from the plan, reading the source file for each window and capping one response at 8 MiB, so no copy of the episode is ever written.
4. Anything this reader cannot express losslessly in MP4 — `ContentEncodings`, laced blocks, a codec with no sample entry it implements — is refused by name at prepare time and reported as an Unsupported torrent file rather than guessed at.

### Settings

`playerStore.initSettings` reads persisted Settings through `db_get_setting`. Volume, preferred Quality, Anime4K preset, Anime4K enabled, and hotkeys are written through `db_save_setting`. Auto-skip and autoplay toggles currently live only in the session state.

## Runtime asset layout

Portable bundle (the only distributed artifact):

```text
Aniplayer/
├─ aniplayer.exe
├─ data/
│  └─ aniplayer.db
└─ downloads/
   ├─ <release_id>/
   │  └─ <ordinal>/
   │     ├─ index.m3u8                    # local HLS playlist
   │     └─ segment-NNNNN.ts              # HLS segments
   └─ torrents/
      ├─ *.torrent                        # downloaded torrent files
      └─ <release_id>/                    # torrent payload
```

All paths are relative to the executable's directory (`startup::app_dir`).

## Persistence

`data/aniplayer.db` is the local-first store (see [ADR 0004](adr/0004-sqlite-local-first-store.md)):

- `bookmarks` — Release id, category, JSON snapshot, timestamps.
- `history` — (Release, Episode) playback position, duration, completion flag, timestamp.
- `downloaded_episodes` — file path, size, Quality, Skip timecodes, Download status.
- `app_settings` — string key/value pairs.

There is no migration framework: the initializer creates missing tables only. Changing an existing table requires an explicit migration and a test.

## Security boundaries

- The production CSP is restrictive and is contract-tested in `src-tauri/tests/test_security_config.rs`. The development CSP relaxes only the Vite dev server (`script-src` inline, local HMR socket).
- The asset protocol is enabled and scoped to `$RESOURCE/downloads/**`; downloaded files never reach the WebView by other means.
- The `remux` protocol serves only streams the app prepared itself, addressed by a token, and never a path. Its URLs are allowed in `media-src` and kept out of `connect-src`, so page script cannot read the torrent library through it.
- The opener capability allows only `magnet:` URLs. The old shell plugin is gone.
- Magnet links are validated before reaching the torrent engine, and `.torrent` paths must canonicalize inside the torrents folder. The same canonicalize-and-confine check gates what `downloader_prepare_stream` will build a plan for.

## Current state and tracked gaps

- **Torrent playback requires a complete download.** There is no piece-level streaming path: the scanner runs only after `librqbit` reports completion, and a Matroska episode is prepared (its plan built) when it is opened, not while it downloads.
- **A payload is only as playable as this machine's decoders.** A codec the WebView says it cannot decode is reported rather than indexed. A Matroska torrent reaches the screen only if its codecs have a sample entry this app implements, so an AV1, VP9, Vorbis or Opus `.mkv` stays outside the downloaded library until the picker can offer a different download; the same payload in a `.webm` the WebView demuxes itself plays if it decodes.
- **The `librqbit-utp` patch is temporary.** It pins the head of upstream `main` for RUSTSEC-2026-0293; that rev also carries the Windows uTP dispatcher fix. Tracked in [#37](https://github.com/shidot3m/aniplayer/issues/37).

## Verification gates

- Frontend: `npm run typecheck`, `npm run lint` (Biome), `npm run test` (Vitest), `npx aislop ci`, `npm run build`.
- Rust: `cargo fmt --check`, `cargo clippy --all-targets --locked -- -D warnings`, `cargo audit`, and the hermetic test suites listed in `.github/workflows/ci.yml` — including the remux and its protocol responder, which run against small real files committed under `src-tauri/tests/fixtures/`.
- The remux is cross-checked against an independent demuxer when it changes: `cargo run --example remux -- <in.mkv> <out.mp4>` writes the same virtual file the protocol serves, and `ffprobe`/`ffmpeg` must report the same frames, timestamps and durations as the source and as `ffmpeg -c copy` of it.
- Feature boundaries, bundle budgets, CSP parity, and the asset-protocol scope are enforced by tests, not by convention alone.
