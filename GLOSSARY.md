# Aniplayer

Aniplayer is a portable Windows player for anime from the AniLiberty catalog, with offline downloads and real-time Anime4K enhancement.

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
A named shader chain selected in Settings: Mode A (HQ), Mode A+A (HQ), Mode B (HQ), Mode B+B (HQ), Mode C (HQ), Mode C+A (HQ), or Mode Fast (APU); enhancement can also be switched off.
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
A Download indexed in the local database with its file path, size, Quality, and Skip timecodes, so it can be played offline. An HLS Download stores a local Offline playlist; a Torrent Download stores a video file the app can deliver to the screen, either as it is or remuxed.
_Avoid_: local file, cached episode

**Offline playlist**:
The `index.m3u8` inside a downloaded Episode folder, whose segment URIs point at the local MPEG-TS segments. The WebView plays it through hls.js.
_Avoid_: cached playlist, manifest file

**Remuxed playback**:
Playback of a Torrent download whose container the WebView cannot demux: the payload is copied frame for frame into an MP4 the WebView does demux, without re-encoding, and reaches the player as a stream rather than as a second file. The player cannot tell it apart from a native episode.
_Avoid_: transcode, converted file, second copy

**Unsupported torrent file**:
A video inside a Torrent download that the app cannot deliver to the screen — a container it cannot remux, or a codec this machine has no decoder for. It is not indexed as a Downloaded episode, and the Downloads screen reports which of the two it is, with the way out for each.
_Avoid_: broken file, missing episode

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

**IPC command**:
A named operation through which the WebView asks the Rust backend to act.
_Avoid_: API call, RPC, endpoint

**Codec capability probe**:
The startup question that settles which codec families this machine can decode, answered per family as decodable, undecodable, or unknown. It is what separates a container the app can remux from a payload nobody can show, and an unknown verdict never opens playback.
_Avoid_: feature check, browser sniffing

See [docs/architecture.md](docs/architecture.md) for how these concepts map onto modules, and [docs/adr/](docs/adr/) for the decisions behind them.
