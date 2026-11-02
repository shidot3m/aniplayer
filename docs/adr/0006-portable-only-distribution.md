# 6. Portable-only distribution

Date: 2026-11-02

Status: accepted

## Context

The app is Windows-only and must keep all of its state — database, downloads, settings, native DLLs, and shaders — in one folder the user can move or delete. Earlier releases published a standalone executable that needed a separate `libmpv-2.dll` download, which produced a half-working artifact and support noise. Installers also spread files and state across the system.

## Decision

- The only distributed artifact is `Aniplayer-portable.zip`. It contains `aniplayer.exe`, `libmpv-2.dll`, the Anime4K shaders, and an empty `data/` folder. `downloads/` is created on demand.
- No MSI, NSIS, or standalone executable is published. The release workflow builds with `npx tauri build --no-bundle`, assembles the folder through `scripts/package_portable.py`, zips it, and verifies that the executable, the DLL, and the shader directory are present.
- All runtime paths are derived from the executable's directory: `data/aniplayer.db`, `downloads/<release_id>/`, and `downloads/torrents/<release_id>/`. The app never writes to a per-user application-data directory.
- The release workflow runs nightly, on manual dispatch for `master`, and on `v*` tags. Nightly and manual builds move the rolling `latest` tag; version tags publish a separate release.
- Updating means replacing the program files while keeping `data/` and `downloads/`.

## Considered options

- **MSI/NSIS installer** — rejected: scatters state, needs elevation, and still needs a bundled native DLL.
- **Standalone executable plus a separate libmpv download** — rejected: the executable starts but playback fails until a second manual step, which was the original support problem.

## Consequences

- The folder must be writable. Installing under a protected location such as `Program Files` will break database and download writes, so the documented location is a user-chosen folder.
- Upgrades are manual file replacement; user data is not removed by the app. The release notes name the preserved folders.
- The Tauri bundler is still configured, but its installers are not part of the release path; only the portable zip is published. Any change to that policy must update the release workflow, `scripts/package_portable.py`, and this ADR.
