# Aniplayer

Aniplayer is a portable Windows player for anime from the AniLiberty catalog, with offline downloads and real-time Anime4K enhancement. Playback runs in the app's own webview: a `<video>` element fed by hls.js, with the React controls over the frame.

## Language

### Catalog

**Release**:
A single anime title in the AniLiberty catalog, identified by a numeric release id (a TV series, film, OVA, and so on).
_Avoid_: anime, title, show, series

**Episode**:
A single playable installment of a Release, identified by an episode id and an Ordinal.
_Avoid_: part, chapter, season

**Ordinal**:
The on-screen number of an Episode within its Release; it may be fractional.
_Avoid_: index, episode number, number

**Franchise**:
A chronologically ordered group of Releases that belong to the same story universe.
_Avoid_: series, collection, related

**Genre**:
A catalog category used to browse and filter Releases.
_Avoid_: tag, category, label

**Schedule**:
The weekly list of Releases with Episodes airing on each weekday.
_Avoid_: calendar, timetable

**Skip timecode**:
The start and stop seconds of an Episode's opening or ending, used to skip it automatically or on request.
_Avoid_: marker, timestamp, intro time

**HLS stream**:
A segmented HTTP video rendition of an Episode.
_Avoid_: video URL, link, stream

**Quality**:
One selectable HLS stream tier: 480p, 720p, or 1080p.
_Avoid_: resolution, bitrate

**Anime4K preset**:
One of the six named enhancement modes the WebGPU renderer ships: Mode A (HQ), Mode A+A (HQ), Mode B (HQ), Mode B+B (HQ), Mode C (HQ), or Mode C+A (HQ); the enhancement can also be switched off. The choice is a persisted Setting and applies to a live frame without restarting the session.
_Avoid_: filter, mode, shader, Mode Fast, APU

**Enhancement**:
The Anime4K processing of the frame the media element presents: the WebGPU renderer paints the filtered frame into a canvas over the element, which keeps decoding and keeps the audio clock. Whether the frame is enhanced is one verdict shared by the controls, the badge and the playback surface — never a second playback path.
_Avoid_: upscaler (in new text), filter chain, shader pipeline, mpv

### User state

**Bookmark**:
A Release saved by the user under exactly one Bookmark category.
_Avoid_: favorite, saved item, list entry

**Bookmark category**:
One of WATCHING, PLANNED, POSTPONED, ABANDONED, NOT_INTERESTED, FAVORITES, or WATCHED.
_Avoid_: status, tag, label

**History entry**:
The stored playback state of one Episode: last position, duration, completion flag, and update time.
_Avoid_: progress record, view, log

**Watch progress**:
The last playback position of an Episode and whether it is finished.
_Avoid_: position, timestamp

**Continue Watching**:
The home-screen list of Episodes that have Watch progress and are not yet completed.
_Avoid_: resume list, recent, in progress

**Download**:
A user-requested local copy of an Episode or Release, produced by an HLS download — the only way to obtain an Episode.
_Avoid_: save, cache, transfer, torrent

**Downloaded episode**:
A Download indexed in the local database with its file path, size, Quality, and Skip timecodes, so it can be played offline. It stores the local Offline playlist of the Episode.
_Avoid_: local file, cached episode

**Offline playlist**:
The `index.m3u8` inside a downloaded Episode folder, whose segment, init-segment, and key URIs point at the local files beside it. The webview plays it over the asset protocol, without the network.
_Avoid_: cached playlist, manifest file

**Download status**:
One of PENDING, DOWNLOADING, COMPLETED, or FAILED.
_Avoid_: state, phase

**Setting**:
A persisted user preference, such as volume, preferred Quality, Anime4K preset, or hotkeys.
_Avoid_: option, config

### Platform

**Portable bundle**:
The only distributed form of the app: a self-contained folder that needs no installation and keeps user data beside the executable.
_Avoid_: installer, package, distribution

**JS toolchain**:
Bun — the single runtime, package manager, and script runner of the project's frontend tooling. It installs dependencies, runs every script and tool, and hosts the tests; no Node runtime or npm client path remains in the project.
_Avoid_: npm, npx, node, package runner

**WebView playback**:
The app's only playback path: a `<video>` element inside the main window, fed by hls.js through Media Source Extensions, drawing the frame under the React controls. Every source — online HLS, Offline playlist, downloaded file — reaches that element.
_Avoid_: native playback, mpv, external player

**Retry walk**:
The session's own bounded answer to a CDN backend that stopped answering: after its count of failed segments is spent and the element has run out of buffered media, the playhead moves one segment past the hole, one segment further each step, until the walk itself runs out and the fault is explained. Steps are never taken while watchable media is still buffered, so a dead host costs its own segment and nothing else.
_Avoid_: retry loop, infinite backoff, stall

**Playable source**:
The URL Rust hands the media element for an Episode source, and the only way a stored path reaches it: a re-parsed `http(s)` URL, or the asset URL of a canonical file inside the downloads folder.
_Avoid_: file path, source string

**IPC command**:
A named operation through which the WebView asks the Rust backend to act.
_Avoid_: API call, RPC, endpoint

See [docs/architecture.md](docs/architecture.md) for how these concepts map onto modules, and [docs/adr/](docs/adr/) for the decisions behind them.
