# Aniplayer Handoff Document

**Date:** 2026-09-15  
**Workspace:** `E:/Coding/Aniplayer`  
**Latest Git Commit:** `HEAD` (`feat: official anime4k presets in settings and embedded headless bittorrent downloader`)  
**Target Focus:** Anime4K Upscaling Configuration, Headless BitTorrent Downloader, Automatic Indexer & Offline Library.

---

## 1. Executive Summary

Aniplayer is a high-performance anime player for Windows built with **Tauri v2 (Rust)** and **React 19 + TypeScript + Tailwind CSS v4**.

In this implementation session, two major core subsystems were designed, built, and verified:
1. **Anime4K Preset Architecture:**
   - Real-time Anime4K v4 preset configuration moved into application Settings (`PlaybackTab.tsx`), offering all 7 official Anime4K v4 algorithms (Mode A (HQ), Mode A+A (HQ), Mode B (HQ), Mode B+B (HQ), Mode C (HQ), Mode C+A (HQ), and Mode Fast (APU)) with descriptions and performance tier badges.
   - Player overlay menu (`SettingsMenu.tsx`) streamlined to a single clean On/Off toggle switch without cluttered preset dropdowns.
   - Removed temporary hardware SVG filter mocks from `PlayerVideoViewport.tsx`.
2. **Headless BitTorrent Download Engine & Scanner:**
   - Integrated headless BitTorrent engine in Rust backend via `librqbit` (`src-tauri/src/downloader/torrent_engine.rs`).
   - Direct background torrent downloading into `downloads/torrents/{release_id}/` without launching external torrent clients.
   - Real-time progress monitoring, transfer speed calculation (B/s), peer counting, and cancellation support.
   - Automatic post-download filesystem scanner (`src-tauri/src/downloader/scanner.rs`) with regex episode ordinal extraction, registering all discovered `.mkv` and `.mp4` files into SQLite `downloaded_episodes`.
   - Frontend integration in `TorrentsTab.tsx` with **«Скачать в приложение»** action, in-card progress bar, and cancellation.
   - Global `DownloadFloatingWidget.tsx` and `downloadStore.ts` tracking both HLS and Torrent downloads.
   - Offline library in `DownloadsView.tsx` with full offline playlist assembly allowing seamless playback and episode switching via Tauri asset protocol (`convertFileSrc`).

---

## 2. Architecture & Key Seams

### 2.1 Backend (Rust / Tauri v2)
* [`src-tauri/src/lib.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/lib.rs): Registered IPC commands `downloader_start_torrent` and `downloader_cancel_torrent`; added `torrent_engine` to `AppState`.
* [`src-tauri/src/downloader/torrent_engine.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/downloader/torrent_engine.rs): Headless BitTorrent client powered by `librqbit::Session`. Tracks tasks, computes dynamic transfer rates, emits `download-progress` and `downloads-updated`, and triggers scanner upon completion.
* [`src-tauri/src/downloader/scanner.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/downloader/scanner.rs): Recursive filesystem scanner utilizing regex (`(?:e|ep|episode|[^\d]|^)\s*(\d{1,4})`) to parse episode numbers from media files and insert them into SQLite.
* [`src-tauri/src/player/mpv_controller.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/player/mpv_controller.rs): MPV libmpv controller loading glsl shaders from `shaders/anime4k/` according to selected preset.

### 2.2 Frontend (React 19 / TypeScript / Zustand)
* [`src/types/index.ts`](file:///E:/Coding/Aniplayer/src/types/index.ts): Definitions for `Anime4kPresetItem`, `DownloadProgressEvent` (with `speed`, `peers`, `downloadedBytes`).
* [`src/store/playerStoreDefaults.ts`](file:///E:/Coding/Aniplayer/src/store/playerStoreDefaults.ts): `ANIME4K_PRESETS` catalog defining all 7 official Anime4K v4 modes.
* [`src/components/settings/PlaybackTab.tsx`](file:///E:/Coding/Aniplayer/src/components/settings/PlaybackTab.tsx): Settings UI for choosing active Anime4K preset.
* [`src/components/player/SettingsMenu.tsx`](file:///E:/Coding/Aniplayer/src/components/player/SettingsMenu.tsx): Clean On/Off switch for Anime4K during playback.
* [`src/store/downloadStore.ts`](file:///E:/Coding/Aniplayer/src/store/downloadStore.ts): Added `startTorrentDownload`, updated `listenToProgress` to normalize torrent events and listen for `downloads-updated`, and mapped `cancelDownload` for `torrent-{id}`.
* [`src/components/TorrentsTab.tsx`](file:///E:/Coding/Aniplayer/src/components/TorrentsTab.tsx): Added «Скачать в приложение» button, in-card live progress bar, speed & peers metrics, and cancel button.
* [`src/components/DownloadsView.tsx`](file:///E:/Coding/Aniplayer/src/components/DownloadsView.tsx): Assembles complete offline playlists for downloaded releases to allow next/previous episode navigation offline.

---

## 3. Verification & Health Status

| Suite | Status | Details |
|---|---|---|
| **Cargo Check** | ✅ **Clean** | Compiles with `librqbit` and `regex` |
| **Cargo Test** | ✅ **11 / 11 passed** | API, DB, MPV Player, and Scanner regex integration tests |
| **Vite & TSC** | ✅ **Build clean** | `bun run build` built successfully in 7.19s with 0 type errors |
| **Vitest** | ✅ **17 / 17 passed** | 7 test suites passing (catalog, anime4k settings, player fixes, fullscreen restore, torrent downloads, player overlay, settings) |

---

## 4. Next Session Focus

1. **E2E & Manual Verification:**
   - Launch app via `bun run tauri dev` or portable build.
   - Verify starting a torrent download from the "Торренты" tab, observing live progress in card and floating widget, and verifying files appear in "Скачанные" once complete.
   - Verify Anime4K preset switching in Settings.
