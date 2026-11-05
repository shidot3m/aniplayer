# 16. Two channels ship: the portable archive and a per-user NSIS installer

Date: 2026-11-05

Status: accepted ([#63](https://github.com/shidot3m/aniplayer/issues/63)); supersedes the portable-only rule of [ADR 0006](0006-portable-only-distribution.md)

## Context

[ADR 0006](0006-portable-only-distribution.md) refused installers for three reasons: they scatter state, they need elevation, and they install into protected locations where the app's own data folder cannot be written. Read against today's build, two of the three are properties of a _per-machine_ install. A per-user NSIS package installs under `%LOCALAPPDATA%\Aniplayer`, records itself in `HKCU` so it appears in "Apps & features" and uninstalls without an elevation prompt, and changes nothing about where state lives — because every runtime path is already derived from the executable's own directory (`startup::app_dir`), the installed copy keeps `data/` and `downloads/` beside its `aniplayer.exe` exactly as the portable one does. The original rejection was an argument against `Program Files`, and it still is.

What portable-only could not answer is the request the ADR never priced: a user who wants the app in the Start Menu and a proper uninstall entry rather than a folder they have to remember. The second half of this ticket is the other thing the old policy left broken: the rolling `latest` release overwrote itself, so an older build was not downloadable at all once a nightly landed on top of it.

## Decision

- **Two channels, one build.** `bunx tauri build` produces the executable the portable archive is packed from _and_ the NSIS installer; the release publishes `Aniplayer-portable.zip`, `Aniplayer-setup.exe`, and `SHA256SUMS.txt` covering both. The installer adds a Start Menu shortcut and the uninstall entry, and nothing else.
- **`installMode = "currentUser"`, spelled out.** Per-machine is not offered, not even as a choice, so `both` is excluded as surely as `perMachine` is: an installer that offers `Program Files` offers a build whose database cannot be created. `src-tauri/tests/test_distribution_config.rs` pins the value instead of trusting the default.
- **The bundler builds NSIS alone** (`targets: ["nsis"]`). An MSI nobody publishes is an MSI nobody tests, and WiX packaging is out of the distribution decision.
- **The app does not learn that channels exist.** No branch on install form anywhere in the tree: `app_dir()` is the executable's directory for a zip extracted to `D:\Aniplayer` and for an installer's `%LOCALAPPDATA%` copy alike, so moving either install to another machine stays a copy of one folder. This is the invariant the guard tests protect, not a property of the portable form.
- **No file associations, no WebView2 floor.** The only association the app ever registered answered a `magnet:` link, and the engine that needed it is gone ([ADR 0013](0013-hls-only-delivery-drops-bittorrent.md)). A minimum WebView2 version would refuse installation over the upscale a machine without WebGPU degrades away anyway ([ADR 0015](0015-anime4k-as-a-webgpu-renderer.md)) — installation is not where codec support is negotiated.
- **Artifact names carry no version.** `latest` is refreshed in place, so versioned filenames would leave `Aniplayer_1.0.0_x64-setup.exe` sitting next to `Aniplayer_1.0.1_x64-setup.exe` and make the release page a history folder; the publishing step deletes every asset outside the current three, and the version lives in the release notes and the installer's own metadata.
- **Checksums are the portable format.** Lowercase hex, the two-space text-mode separator, LF endings, names only — so `sha256sum -c SHA256SUMS.txt` works from a shell on the machine that downloaded it, and the release's own verifier reads the same file it publishes.
- **Nightly and tags are different releases.** A nightly or manual run refreshes `latest` and moves the `latest` ref to the commit it built. A `v*` tag publishes its own release, marked not-latest, holding the same three files, and never moves the tag. The version must agree in `package.json`, `Cargo.toml`, and `tauri.conf.json` or the guard test fails the build, and the workflow refuses a tag that is not `v` plus the configured version — the pair is what `v1.0.0` is cut from.

## Considered options

- **Keep portable-only** — rejected: the three reasons in ADR 0006 do not survive a per-user build, and the Start Menu entry stays the one thing a zip cannot give.
- **`installMode = "both"`** — rejected: it asks users to choose a mode whose second option cannot run the app, and it demands elevation even when the user picks per-user.
- **Data in `%APPDATA%` for the installed copy** — rejected: it splits the copy-one-folder invariant down the middle and teaches the application about a channel it never needs to know about.
- **Ship the installer inside the archive, or one combined download** — rejected: the channel is a decision the user makes before downloading, and a checksum file that names one artifact while hiding another inside it is not a checksum file.
- **Versioned artifact filenames** — rejected above; they turn a rolling release into a pile.
- **Code signing now** — deferred, not rejected: it needs a certificate and a publisher identity the project does not have, so the installer arrives as an unknown-publisher file. Tracked as [#66](https://github.com/shidot3m/aniplayer/issues/66).

## Consequences

- Windows answers a first run of either artifact with a SmartScreen or "unknown publisher" prompt, because nothing is signed. The checksum file is what a user has to verify the bytes with until a certificate exists.
- The installed copy leaves `data/` and `downloads/` behind when uninstalled — they are not part of the installer's payload, so removing the app does not remove what the user put in them. Reclaiming them is Explorer's business, exactly as it already is for the portable folder.
- A release page now has three files instead of one, and every document that said "the only artifact" describes two channels plus their digests.
- `bun run tauri:win build` produces both artifacts locally, so packaging is reproducible without a CI run; the verifier and the checksum step are the same commands the pipeline runs.
- Two channels mean two install trees on a tester's machine. They are the same compilation, and the only difference in the shipped bytes is the three the bundler stamps into the executable's embedded marker — `BUNDLE_TYPE_VAR_UNK` in the portable copy, `BUNDLE_TYPE_VAR_NSS` in the installed one — measured on the two artifacts of this ticket's run. The digests in `SHA256SUMS.txt` are of the published files, not of each other.
