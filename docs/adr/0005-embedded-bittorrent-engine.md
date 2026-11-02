# 5. Embedded BitTorrent engine instead of an external client

Date: 2026-11-02

Status: accepted

## Context

AniLiberty publishes releases as BitTorrent bundles, often the highest-quality HEVC versions. The product needs to download a whole release in the background, show progress in the app, index the resulting episodes for offline playback, and still work from a portable folder. Delegating to an installed torrent client would break that promise and leave the app unable to report progress or index files.

## Decision

- Embed `librqbit` in the Rust backend with a single long-lived `Session`, created during startup. TLS uses rustls; the `librqbit-utp` crate is patched to a git revision on upstream `main` that fixes RUSTSEC-2026-0293 and carries the Windows uTP dispatcher fix, until a release carries `ringbuf` 0.5.2 or newer ([#37](https://github.com/shidot3m/aniplayer/issues/37)).
- `TorrentEngine` owns the session, the database handle, and a map of active tracking tasks. It accepts either a magnet link or an HTTP(S) URL, writes into `downloads/torrents/<release_id>/`, and tracks the torrent handle returned by the session.
- Magnet links are validated before use: the `magnet:` scheme is required, the length is capped, and control characters are rejected. User-supplied `.torrent` paths are canonicalized and confined to the torrents folder before they are opened.
- Every 500 ms a task samples download statistics and emits a `download-progress` event with bytes, percentage, speed, peers, and status (DOWNLOADING, COMPLETED, or CANCELED).
- On completion the torrent scanner walks the release folder, extracts an episode Ordinal from each video filename, and upserts a Downloaded episode row (`torrent-<release_id>-<ordinal>`) into `downloaded_episodes`. It then emits `downloads-updated`, which makes the UI reload the index.
- The app also keeps a system-client escape hatch: `downloader_open_magnet` and `downloader_download_torrent` open a magnet link or a downloaded `.torrent` file with the operating system's registered handler.

## Considered options

- **Hand magnets to an external torrent client** — rejected as the primary path: no in-app progress, no completion hook, and no automatic episode indexing.
- **Bind to libtorrent through C++** — rejected: a native dependency and build toolchain that conflicts with the portable, prebuilt-binary goal.
- **No torrent support** — rejected: HLS alone cannot provide the HEVC quality tiers the catalog publishes.

## Consequences

- The app opens network listeners and participates in DHT; a port or session failure becomes a visible startup error with a message about closing another client.
- The engine downloads the whole release before episodes are indexed; playback from a partially downloaded torrent is not supported.
- Episode identification is filename-based. Ambiguous or unconventional names can produce wrong or missing ordinals, so the scanner patterns and tests are part of the contract.
- Byte-level progress, peer count, and cancel behavior are tied to the `librqbit` API; upgrading it requires re-checking this module and the progress event shape.
