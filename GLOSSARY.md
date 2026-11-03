# Aniplayer

Aniplayer is a portable Windows player for anime from the AniLiberty catalog, with offline downloads and real-time Anime4K enhancement, playing everything through its bundled mpv runtime.

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

**Torrent**:
A BitTorrent bundle published for a Release, identified by a torrent id and carrying codec and quality metadata plus a magnet link or `.torrent` file.
_Avoid_: magnet, file, download

**Anime4K preset**:
A named mpv GLSL shader chain selected in Settings: Mode A (HQ), Mode A+A (HQ), Mode B (HQ), Mode B+B (HQ), Mode C (HQ), Mode C+A (HQ), or Mode Fast (APU); enhancement can also be switched off.
_Avoid_: filter, mode, shader

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
A user-requested local copy of an Episode or Release, produced by an HLS download or a Torrent download.
_Avoid_: save, cache, transfer

**Downloaded episode**:
A Download indexed in the local database with its file path, size, Quality, and Skip timecodes, so it can be played offline. An HLS Download stores a local Offline playlist; a Torrent Download stores the video file as it is — mpv plays any container.
_Avoid_: local file, cached episode

**Offline playlist**:
The `index.m3u8` inside a downloaded Episode folder, whose segment, init-segment, and key URIs point at the local files beside it. mpv plays it directly, without the network.
_Avoid_: cached playlist, manifest file

**Hardware decode**:
Whether mpv put a hardware decoder on this stream (`hwdec-current`); software decode is the fallback. It informs the 4K warning only — no codec verdict gates playback.
_Avoid_: codec probe, capability check

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

**Native playback**:
Playback through the bundled mpv child process — the app's only playback path. The WebView draws the controls; video renders in the `native-player` window under the transparent main window, and every source (online HLS, Offline playlist, downloaded file) reaches mpv, not a `<video>` element.
_Avoid_: external player, mpv fallback

**IPC command**:
A named operation through which the WebView asks the Rust backend to act.
_Avoid_: API call, RPC, endpoint

**Command queue**:
The line of IPC commands one session keeps for mpv, drained by a single writer thread. Handing a command over never waits for mpv, so a pipe mpv has stopped reading costs the playback, not the controls.
_Avoid_: buffer, mailbox, backlog

**Stall watchdog**:
The per-session check on whether mpv still answers the command it was given while the pipe stays silent. A player that fails it is reported as a fault and taken down, so the user gets an error and a working close instead of a frozen player.
_Avoid_: heartbeat, ping, keepalive

See [docs/architecture.md](docs/architecture.md) for how these concepts map onto modules, and [docs/adr/](docs/adr/) for the decisions behind them.
