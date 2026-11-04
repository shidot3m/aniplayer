# 13. HLS-only delivery; BitTorrent dropped

Date: 2026-11-04

Status: accepted

## Context

[ADR 0005](0005-embedded-bittorrent-engine.md) embedded `librqbit` because the catalog's HEVC and high-resolution tiers existed only as torrents, and an external client would have left the app unable to report progress or index the finished files. That decision carried a heavy tail: a long-lived session with network listeners and DHT, so a busy port became a fatal startup error; a filename-based scanner guessing an Ordinal out of each video name; magnet and `.torrent`-path validation; an `magnet:*` capability for the operating-system opener; seeders, leechers and codec badges in the release card; a `peers` field riding along on every progress event; and a pinned git revision of `librqbit-utp` to dodge RUSTSEC-2026-0293 until upstream released a fix ([#37](https://github.com/shidot3m/aniplayer/issues/37), deleted from the tracker together with the patch).

A live measurement of the actual delivery source (2026-11-04: 25 releases × 3 tiers = 75 HLS playlists, 1158 sampled segment URIs) found every AniLiberty HLS stream to be H.264 High / yuv420p plus AAC-LC in plain MPEG-TS, with no master playlist, no init segments, no encryption and no `CODECS=` attribute. That is decodable without any of the machinery ADR 0005 and [ADR 0009](0009-matroska-remux-and-codec-probe.md) were built to serve, and the app already downloads exactly that into an Offline playlist with [ADR 0008](0008-local-hls-offline-downloads.md). The one capability torrents added — a payload the app could not otherwise fetch — was worth less than the failure modes and the surface it brought.

## Decision

- **HLS is the only way to obtain an Episode.** A Release offers one download path: a single Episode or the whole Release through the HLS downloader. The torrent picker tab, magnet buttons, seeder/leecher counters and codec badges leave the interface, and the release API surface stops returning torrents (`api_get_release_torrents`, `TorrentItem`, `TorrentCodec`).
- **The engine and everything hanging off it are deleted, not disabled.** `downloader/torrent_engine.rs`, `downloader/torrent.rs` and `downloader/scanner.rs` go, with the `downloader_start_torrent`, `downloader_cancel_torrent`, `downloader_download_torrent` and `downloader_open_magnet` commands, the `TorrentEngine`/`TorrentDownloader` members of `AppState`, and the two startup error variants that reported an unusable session or folder. `librqbit` and `regex` leave `Cargo.toml`, and the `[patch.crates-io]` section disappears with them.
- **The progress event stops carrying network membership.** One payload shape serves the queue: episode, release, Ordinal, segment counts, bytes transferred, mean throughput, percentage, status and error. The bytes and speed fields move onto the HLS event, because the widget needs them to answer "how long will this take", and the normalization layer that bridged the two former shapes goes with the second shape.
- **`tauri-plugin-opener` stays, and the `magnet:*` capability does not.** The plugin's remaining job is `downloader_open_folder`, which reveals a Downloads folder in Explorer — a use the ticket assumed had gone. The capability file keeps only `core:default` and `core:window:default`: the page itself is granted no outward opening at all, and the guard test now fails if an `opener:` or `shell:` permission or the word `magnet` reappears in it.
- **Legacy rows leave the index, legacy files stay on disk.** Startup runs one idempotent `DELETE` of Downloaded episode rows whose id carries the `torrent-` prefix the scanner wrote. Nothing is removed from the filesystem, so the user's already-downloaded media keeps its place; it simply stops being listed as playable. There is no version marker — one indexed delete per launch is cheap enough to run unconditionally.

## Considered options

- **Keep torrents as an optional high-quality path** — rejected: the tab, the engine, the session, the scanner and the patched dependency are the product's entire network-listener surface, and every one of them stays broken-shaped while present.
- **Hand magnets to an external client as the only torrent route** — rejected: that is the escape hatch ADR 0005 already kept beside the engine and rejected as the primary path, and it still leaves `.torrent` handling in the product.
- **Delete the legacy rows together with their media files** — rejected: the files are the user's property; the app never owned them.
- **Leave the legacy rows in place and filter them in the UI** — rejected: the Downloads library would keep offering paths through a player that no longer exists, and every consumer of the index would need to remember the exception.
- **Cut `tauri-plugin-opener` as well** — rejected: it still serves the folder reveal, and replacing it means hand-rolling a shell call for a feature that works today.

## Consequences

- The catalog's HEVC, 2K and 4K tiers are knowingly forfeited. Playback and downloads reach what AniLiberty serves over HLS: up to 1080p H.264.
- A portable folder that holds old torrent payloads keeps that space on disk with no entry in the app. Reclaiming it is the user's decision, made in Explorer, not the app's.
- Startup gets shorter and loses a failure mode: no listener bind, no DHT, no "another client holds the port" dialog. `bootstrap()` opens the database, purges the legacy rows and builds the HLS downloader.
- `downloads/torrents/` disappears from the documented layout; the folder is no longer created or referenced.
- The scanner's filename heuristics were the only reason `regex` was in the tree, so the dependency goes too, taking `cargo audit` surface with it.
- `downloaded_episodes` gains no column and no migration: the schema was never torrent-specific, which is exactly why a `DELETE` by id prefix is enough.
- The removal is one-direction. Re-adoption would mean reopening ADR 0005, not editing this one.
