# Aniplayer

Aniplayer is a Windows player for anime from the AniLiberty catalog, shipped in two install channels — a portable archive and a per-user installer — with offline downloads and real-time Anime4K enhancement. Playback runs in the app's own webview: a `<video>` element fed by hls.js, with the React controls over the frame.

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

**Text track**:
A timed-text rendition an Episode's stream carries beside picture and sound, which a viewer can switch on, off, or by language.
_Avoid_: subtitle stream, caption file, softsubs

**Hardsub**:
Subtitles burned into the picture of an Episode: always visible, never selectable.
_Avoid_: burned-in subs, softsub

**Anime4K preset**:
One of the six named enhancement modes the WebGPU renderer ships: Mode A (HQ), Mode A+A (HQ), Mode B (HQ), Mode B+B (HQ), Mode C (HQ), or Mode C+A (HQ); the enhancement can also be switched off. The choice is a persisted Setting and applies to a live frame without restarting the session.
_Avoid_: filter, mode, shader, Mode Fast, APU

**Enhancement**:
The Anime4K processing of the frame the media element presents: the WebGPU renderer paints the filtered frame into a canvas over the element, which keeps decoding and keeps the audio clock. Whether the frame is enhanced is one verdict shared by the controls and the playback surface — never a second playback path.
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
One of PENDING, DOWNLOADING, COMPLETED, or FAILED. `DOWNLOADING` is owned by a live task; `FAILED` covers both a download that errored and an Interrupted download the app reconciled at startup.
_Avoid_: state, phase

**Interrupted download**:
An HLS Download whose process died before its task reached a terminal state, leaving a `DOWNLOADING` row with no Offline playlist and orphan segments on disk. The next startup reconciles it to `FAILED` and leaves its bytes in place; the library offers to download it again.
_Avoid_: stalled download, broken download, resume

**Setting**:
A persisted user preference, such as volume, preferred Quality, Anime4K preset, or hotkeys.
_Avoid_: option, config

### Design

**Night cinema**:
The app's design direction, recorded in ADR 0018: a dark screening room where the poster and the playing frame are the only rich visual material and everything around them — chrome, surfaces, type — stays quiet. Dark only; no light theme exists. Its delivery was reverted before release, so it names where the interface is going, not what the current build draws.
_Avoid_: dark theme, new design, redesign style, mode

**Accent**:
The single accent color of the interface as it ships — rose `#e11d48` (`--color-primary`), used for current states, played progress, active navigation and the primary button. The night-cinema direction replaces it with crimson `#A4133C` and a lightened shade for small accent text.
_Avoid_: brand color, orange, highlight color

**Plate**:
A small tinted label stating a fact about content: the format («ТВ»), the year, the episode duration, the Quality of a downloaded Episode («1080p»). Plates are the shipped way to state those facts; the night-cinema direction removes them in favour of tone steps and plain text.
_Avoid_: badge, chip, tag, pill

**Timecode**:
Playback position and Episode duration read as `mm:ss` — in the player's bottom bar, on the resume card and on the episode rows. The single tabular-numeral treatment across every duration and Ordinal is part of the night-cinema direction and is not in the current build.
_Avoid_: mono labels, code font, counters

### Platform

**Install channel**:
One of the two forms a build ships in: the portable archive or the per-user installer. Both keep their data beside their own executable, so nothing in the app knows which channel it is running under.
_Avoid_: edition, flavor, variant, build type

**Portable bundle**:
The channel that needs no installation — `aniplayer.exe` and an empty `data/` in an archive, unpacked wherever the user can write. Moving it to another machine is copying one folder.
_Avoid_: zip build, standalone executable

**Setup installer**:
The per-user NSIS channel: it adds a Start Menu shortcut and an uninstall entry, installs into the user's own profile without elevation, and registers nothing else. Removing the app leaves `data/` and `downloads/` on disk, because they were never part of its payload.
_Avoid_: MSI, per-machine install, package

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
