# 9. Matroska plays through a pure-Rust remux and a startup codec probe

Date: 2026-11-02

Status: accepted

## Context

AniLiberty publishes most of its Releases as Matroska torrents — H.264 in `.mkv`, and the compact ones as HEVC. [ADR 0008](0008-local-hls-offline-downloads.md) gated the downloaded library on the container extension, so a `.mkv` was reported as an Unsupported torrent file and never became a Downloaded episode. That gate assumed the container is the whole question, and it is not. Measured on the machine this project targets:

| payload                                 | `canPlayType` | decoded frame     |
| --------------------------------------- | ------------- | ----------------- |
| H.264 in MP4 (control)                  | maybe         | 1920×1080 — plays |
| HEVC Main 10, remuxed from MKV into MP4 | maybe         | 0×0 — no decoder  |
| HEVC Main 10 in the original MKV        | maybe         | 0×0               |

WebView2 answers `maybe` for both, so no amount of container sniffing separates "plays" from "black screen". Remuxing alone would therefore ship a feature that silently does nothing where there is no HEVC decoder — the failure this ticket exists to remove. The other constraints stay in force: no native libmpv layer ([ADR 0007](0007-remove-native-libmpv-layer.md)) and a portable artifact that is "executable plus empty data folder" ([ADR 0006](0006-portable-only-distribution.md)), which rules out bundling ffmpeg or downloading it at runtime.

## Decision

- **Stream copy, in Rust, in the backend.** `src-tauri/src/remux/` carries its own EBML reader for Matroska and its own ISO BMFF writer for MP4. No frame is re-encoded or even rewritten: Matroska stores AVC and HEVC with the same length-prefixed framing MP4 uses, so a block's bytes become a sample's bytes unchanged, and only the container is rebuilt.
- **The remuxed bytes never land on disk.** `RemuxService` builds a `Plan` — the MP4 sample tables plus a map from each virtual byte range to an offset in the source file — and serves it through the `remux` custom URI scheme protocol, answering `Range` requests with `206` and capping any one response at 8 MiB. `downloader_prepare_stream` returns a token URL (`http://remux.localhost/<token>`), so the protocol surface carries no filesystem path and can read nothing the app has not agreed to play.
- **A startup probe answers what this machine decodes.** `src/features/player/lib/codecCapability.ts` asks one question per codec family: `canPlayType` when it is decisive, otherwise `navigator.mediaCapabilities.decodingInfo` for a file, with `MediaSource.isTypeSupported` as a negative check. The verdict is `decodable`, `undecodable`, or `unknown`, and `unknown` never opens playback. HEVC is probed at Main 10 because that is what the catalog ships. The report goes to `app_report_codec_capability` once, at startup, and lands in `AppState.codec_caps`.
- **The verdict is used in three places.** The Torrent picker declines to recommend a codec this machine cannot decode. The scanner classifies every downloaded file with `classify_video` — `Native`, `Remux`, or `Blocked` — and only the first two become Downloaded episodes. The Downloads screen shows the per-file reason, naming the concrete way out: another Release download for a container or codec the app cannot carry, the external player for a codec the machine lacks.
- **MP4's own timeline vocabulary carries the timing.** An AAC track's priming frame is skipped by an edit list rather than silently shifting audio behind picture; B-frame reordering goes into `ctts` against a decode grid, and the composition delay that outlives the grid is added to the last sample so the declared duration reaches the last picture.

## Considered options

- **Write the remuxed MP4 next to the source.** Rejected: it leaves a second full-size copy of the episode on disk, needs a cleanup path of its own, and contradicts the acceptance criteria.
- **A local fragmented-MP4 playlist through hls.js.** Rejected: ADR 0008 already refuses `#EXT-X-MAP` playlists in the offline loader, and it would need a second muxer (init segments plus a box stream) to produce something a plain `src` does just as well.
- **Bundle ffmpeg, or a Rust transcoder.** Rejected: ADR 0006 and ADR 0007, and transcoding a full episode is exactly the CPU-bound work the ticket forbids.
- **Trust `canPlayType` alone.** Rejected: it answers `maybe` for HEVC on a machine with no decoder, which is the black frame this decision exists to avoid.
- **Probe only when playback starts.** Rejected: the episode would still be indexed, still be offered from the Downloads list, and still fail there instead of at the picker.

## Consequences

- The app owns an EBML reader and an MP4 writer. They are verified against real ffmpeg-produced files with ffmpeg itself as an independent demuxer: the remuxed frames match the source's presentation timestamps, sizes and key-frame flags, and match what `ffmpeg -c copy` writes for the same input.
- Adding a codec family means three edits that have to agree: a probe candidate in the frontend, a `CodecFamily` mapping in `codec.rs`, and an MP4 sample entry in `mp4_entry`. Anything unmapped is refused by name rather than guessed at.
- Remux covers what this reader can express losslessly: no `ContentEncodings`, no laced blocks, and only the codecs with a sample entry implemented here — `avc1`, `hvc1`, `mp4a`. MP4 does register entries for Opus, Vorbis and FLAC, but this app implements none of them, so a Matroska file carrying one stays on disk and is reported, naming the codec, rather than indexed and guessed at.
- Playing a remuxed episode reads the source file repeatedly by range. Plans are held in a four-entry LRU, so a long pause or a fourth episode evicts an old plan; a stream that is still being read is kept warm by its own requests.
- The portable artifact is unchanged: no new binary, no new bundled asset, no runtime download.
- `downloaded_episodes` gains no column. The Matroska payload is stored as its own `.mkv` path, which is what marks the remux route, so the offline layout and the stored rows of ADR 0008 keep working untouched.
