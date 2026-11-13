# 6. Portable-only distribution

Date: 2026-11-02

Status: accepted, amended by [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md); build command updated per [ADR 0011](0011-bun-as-the-js-toolchain.md); runtime paths amended by [ADR 0013](0013-hls-only-delivery-drops-bittorrent.md); archive contents restored to this ADR's form by [ADR 0014](0014-webview-is-the-only-playback-backend.md); the portable-only rule and the `bunx tauri build --no-bundle` command in Decision are superseded by [ADR 0016](0016-portable-archive-and-per-user-nsis-installer.md)

## Context

The app is Windows-only and must keep all of its state — database, downloads, and settings — in one folder the user can move or delete. Earlier releases published a standalone executable that needed a separate `libmpv-2.dll` download, which produced a half-working artifact and support noise. Installers also spread files and state across the system.

## Decision

- The only distributed artifact is `Aniplayer-portable.zip`. It contains `aniplayer.exe` and an empty `data/` folder. `downloads/` is created on demand.
- No MSI, NSIS, or standalone executable is published. The release workflow builds with `bunx tauri build --no-bundle`, assembles the folder through `scripts/package_portable.py`, zips it, and verifies that the executable is present.
- All runtime paths are derived from the executable's directory: `data/aniplayer.db`, `downloads/<release_id>/`, and `downloads/torrents/<release_id>/`. Database, downloads, and settings live only there. Tauri forces WebView2's own cache into the default per-user location (`%LOCALAPPDATA%`), which carries no portable state and can be deleted.
- The release workflow runs on manual dispatch for `master` and on `v*` tags. Manual builds move the rolling `latest` tag; version tags publish a separate release. (A scheduled nightly build was part of this at decision time; it was removed by [ADR 0020](0020-releases-publish-on-demand-only.md).)
- Updating means replacing the program files while keeping `data/` and `downloads/`.

## Considered options

- **MSI/NSIS installer** — rejected: scatters state, needs elevation, and installs into protected locations where the portable data folder cannot be written.
- **Standalone executable plus a separate libmpv download** — rejected: the executable starts but playback fails until a second manual step, which was the original support problem.

## Consequences

- The folder must be writable. Installing under a protected location such as `Program Files` will break database and download writes, so the documented location is a user-chosen folder.
- Upgrades are manual file replacement; user data is not removed by the app. The release notes name the preserved folders.
- The Tauri bundler is still configured, but its installers are not part of the release path; only the portable zip is published. Any change to that policy must update the release workflow, `scripts/package_portable.py`, and this ADR.
- The archive no longer carries native media libraries or GLSL shaders: playback and Anime4K run entirely in the WebView ([ADR 0007](0007-remove-native-libmpv-layer.md)).

## Amendment (2026-11-02, [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md))

- The archive is **`aniplayer.exe` plus its media runtime plus an empty `data/` folder**: `mpv/mpv.exe` with its DLLs (pinned by version and SHA-256 in `scripts/get_mpv.py`) and `shaders/anime4k/*.glsl` sit beside the executable. The last consequences line above — no native media libraries — no longer holds.
- The archive check asserts `aniplayer.exe`, `mpv/mpv.exe`, and the Anime4K shaders; a bundle without the runtime cannot play anything, so `scripts/package_portable.py` refuses to produce one.

## Amendment (2026-11-04, [ADR 0013](0013-hls-only-delivery-drops-bittorrent.md))

- `downloads/torrents/<release_id>/` is no longer a runtime path. The app creates nothing there, reads nothing from it, and lists nothing it holds; the folder survives only as whatever an older build left behind, and reclaiming it is the user's business in Explorer. The runtime paths are now `data/aniplayer.db` and `downloads/<release_id>/<ordinal>/`.
- Startup does touch that inheritance, but only in the index: `startup::purge_legacy_torrent_downloads` drops the Downloaded episode rows the retired scanner wrote under the `torrent-` id prefix. It deletes no file, which is the "user data is not removed by the app" consequence above holding exactly as written.
