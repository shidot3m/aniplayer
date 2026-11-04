# 8. Offline HLS downloads keep a local playlist

Date: 2026-11-02

Status: accepted, amended by [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md) and [ADR 0013](0013-hls-only-delivery-drops-bittorrent.md); the reader of the folder is the webview under [ADR 0014](0014-webview-is-the-only-playback-backend.md)

## Context

The HLS downloader used to concatenate the `.ts` segments served by the AniLiberty CDN and write the bytes into `<ordinal>.mp4`. WebView2 has no MPEG-TS demuxer for `<video src>`, and hls.js only understands playlists, so those files never played offline even though the asset protocol served them correctly ([#35](https://github.com/shidot3m/aniplayer/issues/35)).

The obvious alternatives conflict with earlier decisions: the native libmpv backend was removed in [ADR 0007](0007-remove-native-libmpv-layer.md), and the portable-only bundle in [ADR 0006](0006-portable-only-distribution.md) rules out shipping ffmpeg or another large native binary. A pure-Rust TS demuxer plus MP4 muxer would add a large, hard-to-verify component for the same outcome.

## Decision

- A downloaded episode is a folder: `downloads/<release_id>/<ordinal>/index.m3u8` plus `segment-00000.ts`, `segment-00001.ts`, and so on.
- The source media playlist is rewritten to point at the local segment names while every tag (`#EXTINF`, target duration, media sequence) is preserved. `#EXT-X-ENDLIST` is added when absent so the result is a closed VOD playlist.
- The stored `file_path` is the local playlist. `offlineStreamUrl` serves it through the asset protocol, and `useHlsVideo` routes any `.m3u8` — remote or asset-served — through hls.js. hls.js demuxes the TS segments and feeds fMP4 to Media Source Extensions, which WebView2 supports. The asset URL for a playlist replaces the percent-encoded backslashes of the Windows path with forward slashes: hls.js resolves relative segment URIs against that URL, and an encoded backslash path has no folder hierarchy to resolve against.
- Playlists that cannot be stored offline are rejected with an actionable error instead of producing a broken file: `#EXT-X-MAP` (fragmented MP4), `#EXT-X-KEY` (encryption), `#EXT-X-STREAM-INF` (master playlist, which needs another playlist level), and `#EXT-X-BYTERANGE` (several segments in one file). AniLiberty serves plain MPEG-TS.
- The playlist is written last and its presence marks a complete download. Cancelling or failing removes the whole episode folder; deleting an episode removes the folder when the stored path is a playlist and the single file otherwise. A legacy `<ordinal>.mp4` next to the new folder is removed when that episode is downloaded again.
- Torrent payloads are indexed when the app can actually put them on screen: a container the WebView demuxes (`.mp4`, `.webm`) plays as it is, and a Matroska file whose codecs are supported and decodable on this machine is indexed as itself and remuxed at play time. What blocks a file is codec availability as well as container demuxability, so `downloader_list_unsupported_files` walks `downloads/torrents/<release_id>/`, reports each skipped file with its size and its own reason, and the Downloads screen offers the way out with a button that opens the torrent folder. [ADR 0009](0009-matroska-remux-and-codec-probe.md) records that rule.

## Considered options

- **Remux TS to MP4 while downloading** — rejected: it needs a TS demuxer and MP4 muxer in Rust, or a bundled ffmpeg, for a result hls.js already produces in the WebView. The reader and writer this eventually required were built later for Matroska torrents, where no in-WebView alternative existed ([ADR 0009](0009-matroska-remux-and-codec-probe.md)).
- **Point the player at the remaining remote playlist** — rejected: an offline copy must not depend on the CDN, and the playlist plus segments are both required.
- **Route local files through the native MPV backend** — rejected: contradicts [ADR 0007](0007-remove-native-libmpv-layer.md) and would reintroduce the FFI layer the project deliberately removed.
- **Index every torrent video regardless of container** — rejected: the Downloads library would offer playback that silently fails.

## Consequences

- Downloads use one folder per episode instead of one file. Size metadata covers the segments and the playlist; delete and cancel operate on the folder.
- Offline playback requires hls.js and Media Source Extensions (already required for online HLS), but no native codec or demuxer in the backend.
- Torrent releases whose payloads this app cannot deliver to the screen — an unreadable container such as AVI, or a codec this machine has no decoder for — stay on disk and show no playable episodes; the Downloads screen explains which of the two it is and offers the folder. A Matroska release whose codecs are supported and decodable is indexed and played through the remux instead ([ADR 0009](0009-matroska-remux-and-codec-probe.md)).
- Changing the offline layout again would invalidate paths stored in `downloaded_episodes`; the current rows point at playlists. Rows written by the old layout still point at TS-in-`.mp4` files and keep failing to play until the episode is downloaded again (which replaces the row) or deleted.

## Amendment (2026-11-02, [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md))

- Offline playback no longer requires hls.js or Media Source Extensions. The stored playlist is handed to mpv (`player_open`), which demuxes the local TS segments itself; the asset protocol is disabled entirely.
- `#EXT-X-MAP` and `#EXT-X-KEY` playlists are now storable: the downloader fetches the init segments and keys into the episode folder (`init-NNNNN.mp4`, `key-NNNNN.key`) and rewrites their URIs to the local names, because mpv replays exactly what a browser could not. `#EXT-X-STREAM-INF` (master) and `#EXT-X-BYTERANGE` remain rejected.
- Torrent payloads are no longer classified by decodability: mpv plays any container ffmpeg reads, so the scanner indexes every video file and the Unsupported torrent file reporting is gone.

## Amendment (2026-11-04, [ADR 0013](0013-hls-only-delivery-drops-bittorrent.md))

- BitTorrent left the product, so the offline layout above is the only download layout: no scanner indexes a release folder any more, `downloads/torrents/` is not created or read, and the `#EXT-X-MAP` / `#EXT-X-KEY` localization the last amendment added stays — the measured source uses neither, but it is tested and it protects offline playback if the scheme changes.
- The rows the scanner wrote survive as data the app no longer understands, so startup drops them from `downloaded_episodes` by their `torrent-` id prefix and leaves the files on disk. The "current rows point at playlists" consequence above is now true without exception for anything the app lists.
