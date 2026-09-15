# Aniplayer Handoff Document

**Date:** 2026-09-15  
**Workspace:** `E:/Coding/Aniplayer`  
**Latest Git Commit:** `e5f5f5b8e7ee427590783dd7722fad9a234ac794` (`fix(player,watched,downloads): fix watched toggle, close mpv player, add download cancellation and hevc torrents`)  
**Target Focus:** Documentation (`docs/`), downloads management, and offline player readiness.

---

## 1. Executive Summary

Aniplayer is a modern desktop anime player application for Windows built with **Tauri v2 (Rust)** and **React 19 + TypeScript + Tailwind CSS v4**. It features high-quality streaming via the Anilibria API/CDN, Real-time Anime4K shader upscaling, SQLite-backed history/bookmarks/settings, integrated HLS downloading with opening/ending skip markers, and HEVC/x265 torrent downloading with magnet link integration.

The most recent session resolved four critical bugs and introduced HEVC torrent integration:
1. **Watched Episodes Toggle:** Fixed SQLite query and Zustand store to keep watched episodes in history so badges and checkmarks update reactively and reliably.
2. **Standalone MPV Window Glitch:** Eliminated rogue headless MPV window generation during HTML5/HLS playback, and added proper `player_stop` lifecycle teardown.
3. **Download Cancellation & Concurrency:** Added per-episode cancellation tokens (`Arc<AtomicBool>`) in Tokio background tasks, cleaning up partial `.mp4` files and notifying the UI with `"CANCELLED"` status.
4. **HEVC Torrent Downloads:** Created backend `TorrentDownloader` for downloading `.torrent` files and opening magnets, and integrated `TorrentsTab` in `ReleaseDetails` with HEVC filtering.
5. **Aislop Quality Gate:** Codebase achieved **100/100 Healthy** score across all 5 verification engines.

---

## 2. Architecture & Key Seams

### 2.1 Backend (Rust / Tauri v2)
* [`src-tauri/src/lib.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/lib.rs): Entry point registering IPC handlers and managing `AppState` (`AnilibriaClient`, `Database`, `HlsDownloader`, `TorrentDownloader`, `MpvPlayer`).
* [`src-tauri/src/downloader/hls.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/downloader/hls.rs): HLS stream downloader with segment concurrency, cancellation token registry (`active_tasks`), partial file cleanup, and progress events.
* [`src-tauri/src/downloader/torrent.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/downloader/torrent.rs): Torrent file downloader (`downloads/torrents/`), file sanitization, and Windows `cmd /C start ""` magnet launcher.
* [`src-tauri/src/db/repository.rs`](file:///E:/Coding/Aniplayer/src-tauri/src/db/repository.rs): SQLite database repository managing bookmarks, watched history (`get_all_history`), settings, and downloaded episode metadata.

### 2.2 Frontend (React 19 / TypeScript / Zustand)
* [`src/store/playerStore.ts`](file:///E:/Coding/Aniplayer/src/store/playerStore.ts) & [`src/store/playerStoreDefaults.ts`](file:///E:/Coding/Aniplayer/src/store/playerStoreDefaults.ts): Player state management (quality resolution, hotkeys, Anime4K settings, volume, time tracking).
* [`src/store/catalogStore.ts`](file:///E:/Coding/Aniplayer/src/store/catalogStore.ts): Catalog pagination, search, bookmarks, and optimistic history tracking.
* [`src/store/downloadStore.ts`](file:///E:/Coding/Aniplayer/src/store/downloadStore.ts): Global download state, Tauri IPC cancel hooks, and floating progress tracking.
* [`src/components/TorrentsTab.tsx`](file:///E:/Coding/Aniplayer/src/components/TorrentsTab.tsx): Torrent list with HEVC filter toggle, seeds/peers/size badges, magnet open/copy, and `.torrent` download.
* [`src/components/ReleaseDetails.tsx`](file:///E:/Coding/Aniplayer/src/components/ReleaseDetails.tsx): Release details view with hero, episode grid, torrents tab, and franchise relationships.
* [`src/components/DownloadFloatingWidget.tsx`](file:///E:/Coding/Aniplayer/src/components/DownloadFloatingWidget.tsx): Floating widget displaying active downloads with cancellation actions.

---

## 3. Verification & Health Status

| Suite | Status | Details |
|---|---|---|
| **Aislop Scan** | ✅ **100 / 100 Healthy** | 0 errors, 0 warnings across Code Quality, AI Slop, Formatting, Linting, Security |
| **Cargo Test** | ✅ **20 / 20 passed** | 10 unit tests, 5 API tests, 4 DB tests, 1 headless MPV test |
| **Vite & TSC** | ✅ **Build clean** | `bun run build` built in 8.75s with zero type errors |
| **Vitest** | ✅ **4 / 4 passed** | Catalog, settings, and player overlay component tests |
| **Biome** | ✅ **Clean** | 48 files formatted and compliant |

---

## 4. Next Session Focus & Roadmap (`docs/` & Future Steps)

As requested by the user (`/handoff в docs`):
1. **Documentation Updates in `docs/`:**
   - Update architecture diagrams and data-flow specifications to reflect the new torrent downloading subsystem and download cancellation mechanics.
   - Document the IPC command interface between Rust and the React frontend in `docs/api.md` or `docs/ipc.md`.
   - Update instructions for offline playback and downloaded files management.
2. **Downloaded Anime Tab & Offline Playback:**
   - Wire the top bar "Скачанные" tab to show saved offline episodes directly from the SQLite database (`db_get_downloaded_episodes`).
   - Enable local file playback in `PlayerVideoViewport` using Tauri's custom protocol or asset loader when an episode is marked `COMPLETED`.
3. **Download Floating Widget Polish:**
   - Persist completed download notifications and expand/collapse states cleanly across views.

---

## 5. Suggested Skills for the Next Agent

The next agent should invoke or review the following skills:
* **`tauri-v2`**: For extending Tauri IPC commands, filesystem access, and asset protocols for offline video playback.
* **`rust-best-practices`**: For maintaining idiomatic, safe Rust in `src-tauri` without `.unwrap()` or deadlocks.
* **`design-taste-frontend`**: For maintaining the OLED Cinema dark design language (`#090A0F`, `#12131A`, accent `#E11D48`, emerald `#10B981`).
* **`ui-ux-pro-max`**: For refining the floating download widget and downloaded episodes view.
* **`zustand`**: For state updates and selectors in `downloadStore` and `catalogStore`.
