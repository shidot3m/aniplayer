# 8. Offline HLS downloads keep a local playlist

Date: 2026-11-02

Status: accepted

## Context

The HLS downloader used to concatenate the `.ts` segments served by the AniLiberty CDN and write the bytes into `<ordinal>.mp4`. WebView2 has no MPEG-TS demuxer for `<video src>`, and hls.js only understands playlists, so those files never played offline even though the asset protocol served them correctly ([#35](https://github.com/shidot3m/aniplayer/issues/35)).

The obvious alternatives conflict with earlier decisions: the native libmpv backend was removed in [ADR 0007](0007-remove-native-libmpv-layer.md), and the portable-only bundle in [ADR 0006](0006-portable-only-distribution.md) rules out shipping ffmpeg or another large native binary. A pure-Rust TS demuxer plus MP4 muxer would add a large, hard-to-verify component for the same outcome.

## Decision

- A downloaded episode is a folder: `downloads/<release_id>/<ordinal>/index.m3u8` plus `segment-00000.ts`, `segment-00001.ts`, and so on.
- The source media playlist is rewritten to point at the local segment names while every tag (`#EXTINF`, target duration, media sequence) is preserved. `#EXT-X-ENDLIST` is added when absent so the result is a closed VOD playlist.
- The stored `file_path` is the local playlist. `offlineStreamUrl` serves it through the asset protocol, and `useHlsVideo` routes any `.m3u8` — remote or asset-served — through hls.js. hls.js demuxes the TS segments and feeds fMP4 to Media Source Extensions, which WebView2 supports. The asset URL for a playlist replaces the percent-encoded backslashes of the Windows path with forward slashes: hls.js resolves relative segment URIs against that URL, and an encoded backslash path has no folder hierarchy to resolve against.
- Playlists that cannot be stored offline are rejected with an actionable error instead of producing a broken file: `#EXT-X-MAP` (fragmented MP4), `#EXT-X-KEY` (encryption), `#EXT-X-STREAM-INF` (master playlist, which needs another playlist level), and `#EXT-X-BYTERANGE` (several segments in one file). AniLiberty serves plain MPEG-TS.
- The playlist is written last and its presence marks a complete download. Cancelling or failing removes the whole episode folder; deleting an episode removes the folder when the stored path is a playlist and the single file otherwise. A legacy `<ordinal>.mp4` next to the new folder is removed when that episode is downloaded again.
- Torrent payloads are indexed only when WebView2 can demux the container (`.mp4`, `.webm`). Files in other containers (`.mkv`, `.avi`, and similar) are not indexed; `downloader_list_unsupported_files` walks `downloads/torrents/<release_id>/` on demand and the Downloads screen reports them with sizes, an explanation, and a button that opens the torrent folder.

## Considered options

- **Remux TS to MP4 while downloading** — rejected: needs a TS demuxer and MP4 muxer in Rust, or a bundled ffmpeg, for a result hls.js already produces in the WebView.
- **Point the player at the remaining remote playlist** — rejected: an offline copy must not depend on the CDN, and the playlist plus segments are both required.
- **Route local files through the native MPV backend** — rejected: contradicts [ADR 0007](0007-remove-native-libmpv-layer.md) and would reintroduce the FFI layer the project deliberately removed.
- **Index every torrent video regardless of container** — rejected: the Downloads library would offer playback that silently fails.

## Consequences

- Downloads use one folder per episode instead of one file. Size metadata covers the segments and the playlist; delete and cancel operate on the folder.
- Offline playback requires hls.js and Media Source Extensions (already required for online HLS), but no native codec or demuxer in the backend.
- Torrent releases that only contain Matroska or AVI payloads stay on disk but show no playable episodes; the Downloads screen explains why and offers the folder.
- Changing the offline layout again would invalidate paths stored in `downloaded_episodes`; the current rows point at playlists. Rows written by the old layout still point at TS-in-`.mp4` files and keep failing to play until the episode is downloaded again (which replaces the row) or deleted.
