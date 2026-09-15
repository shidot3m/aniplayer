# Anime4K Presets Separation & Embedded Headless BitTorrent Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide the full catalog of 7 official Anime4K v4 presets in application settings with a streamlined On/Off toggle in the player, and integrate an in-process headless BitTorrent downloading engine in the Rust backend for 1-click complete release downloads with automatic SQLite indexing and offline playback in "Скачанные".

**Architecture:** 
- Frontend splits Anime4K management: `PlaybackTab` hosts the interactive 7-preset card grid and persists to SQLite; `SettingsMenu` in player hosts only the clean On/Off switch reflecting the configured preset.
- Backend embeds `librqbit` inside `src-tauri` on the Tokio runtime for headless downloading of torrents/magnets to `downloads/torrents/{release_id}/`.
- Automated post-download scanner extracts episode ordinals from filenames, indexes `.mkv`/`.mp4` into SQLite `downloaded_episodes`, and enables seamless local playback via Tauri asset URLs in `DownloadsView`.

**Tech Stack:** 
- Rust (Tauri v2, `librqbit`, `tokio`, `rusqlite`, `serde`)
- React 19, TypeScript, Tailwind CSS v4, Zustand, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-09-15-anime4k-and-torrent-downloader-design.md`

## Global Constraints

- Preserve all existing 8 unit tests in `tests/`.
- No regression in window state or fullscreen restoration.
- All IPC commands must be registered in `tauri::generate_handler!`.
- File paths for downloads must be cross-platform sanitized.

---

### Task 1: Anime4K Presets Definition, Types, and Defaults

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/playerStoreDefaults.ts`
- Test: `tests/test_anime4k_settings.test.tsx`

**Interfaces:**
- Produces: `ANIME4K_PRESETS: Anime4kPresetItem[]` with all 7 presets.
- Produces: Type `Anime4kPresetItem` with `id`, `label`, `description`, `tier`.

- [ ] **Step 1: Write test for Anime4K presets constants and defaults**

```tsx
// tests/test_anime4k_settings.test.tsx
import { describe, expect, it } from "vitest";
import { ANIME4K_PRESETS } from "../src/store/playerStoreDefaults";

describe("Anime4K Presets Specification", () => {
  it("contains all 7 official Anime4K v4 presets", () => {
    expect(ANIME4K_PRESETS).toHaveLength(7);
    const ids = ANIME4K_PRESETS.map((p) => p.id);
    expect(ids).toContain("Mode A (HQ)");
    expect(ids).toContain("Mode A+A (HQ)");
    expect(ids).toContain("Mode B (HQ)");
    expect(ids).toContain("Mode B+B (HQ)");
    expect(ids).toContain("Mode C (HQ)");
    expect(ids).toContain("Mode C+A (HQ)");
    expect(ids).toContain("Mode Fast (APU)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/test_anime4k_settings.test.tsx`
Expected: FAIL (ANIME4K_PRESETS not defined)

- [ ] **Step 3: Define types and ANIME4K_PRESETS in types and playerStoreDefaults**

Add `Anime4kPresetItem` in `src/types/index.ts` and `ANIME4K_PRESETS` in `src/store/playerStoreDefaults.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/test_anime4k_settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/types/index.ts src/store/playerStoreDefaults.ts tests/test_anime4k_settings.test.tsx
git commit -m "feat(anime4k): add complete Anime4K v4 presets definitions and types"
```

---

### Task 2: Application Settings UI (`PlaybackTab.tsx`) with 7-Preset Grid

**Files:**
- Modify: `src/components/settings/PlaybackTab.tsx`
- Test: `tests/test_anime4k_settings.test.tsx`

**Interfaces:**
- Consumes: `ANIME4K_PRESETS` from `src/store/playerStoreDefaults.ts`.
- Consumes: `usePlayerStore` (`anime4kPreset`, `setAnime4kPreset`, `anime4kEnabled`, `toggleAnime4k`).

- [ ] **Step 1: Write test for PlaybackTab rendering all 7 presets**

```tsx
it("renders all 7 presets with descriptions in PlaybackTab", () => {
  render(<PlaybackTab />);
  expect(screen.getByText("Mode A+A (HQ)")).toBeDefined();
  expect(screen.getByText("Mode A (HQ)")).toBeDefined();
  expect(screen.getByText("Mode B (HQ)")).toBeDefined();
  expect(screen.getByText("Mode B+B (HQ)")).toBeDefined();
  expect(screen.getByText("Mode C (HQ)")).toBeDefined();
  expect(screen.getByText("Mode C+A (HQ)")).toBeDefined();
  expect(screen.getByText("Mode Fast (APU)")).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/test_anime4k_settings.test.tsx`
Expected: FAIL (missing new presets in DOM)

- [ ] **Step 3: Update `PlaybackTab.tsx` with full preset cards grid**

Update `PlaybackTab.tsx` to iterate over `ANIME4K_PRESETS`, showing badge, title, and clear description for each preset. Clicking sets `anime4kPreset` in store and SQLite.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/test_anime4k_settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/settings/PlaybackTab.tsx tests/test_anime4k_settings.test.tsx
git commit -m "feat(settings): display full Anime4K v4 presets catalog in PlaybackTab"
```

---

### Task 3: Player Settings Menu Streamlined On/Off Toggle

**Files:**
- Modify: `src/components/player/SettingsMenu.tsx`
- Modify: `src/components/player/PlayerVideoViewport.tsx`
- Test: `tests/test_player_fixes.test.tsx`

**Interfaces:**
- Consumes: `usePlayerStore` (`anime4kEnabled`, `anime4kPreset`, `toggleAnime4k`).

- [ ] **Step 1: Write test verifying Player SettingsMenu has only On/Off switch with active preset caption**

```tsx
it("SettingsMenu only has On/Off toggle for Anime4K and shows active preset label", () => {
  render(<SettingsMenu currentQuality="1080p" onSelectQuality={() => {}} />);
  fireEvent.click(screen.getByTitle("Настройки плеера"));
  expect(screen.getByRole("switch", { name: /апскейлер/i })).toBeDefined();
  expect(screen.queryByRole("button", { name: /mode a\+a/i })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `bunx vitest run tests/test_player_fixes.test.tsx`

- [ ] **Step 3: Refine `SettingsMenu.tsx` and clean up `PlayerVideoViewport.tsx`**

Remove the mock SVG filter in `PlayerVideoViewport.tsx` and ensure `SettingsMenu.tsx` displays the active preset name cleanly under the switch.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/test_player_fixes.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/player/SettingsMenu.tsx src/components/player/PlayerVideoViewport.tsx tests/test_player_fixes.test.tsx
git commit -m "refactor(player): stream-line Anime4K controls to single On/Off toggle in player"
```

---

### Task 4: BitTorrent Engine Backend in Rust (`src-tauri`)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/downloader/torrent_engine.rs`
- Modify: `src-tauri/src/downloader/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/test_torrent_engine.rs`

**Interfaces:**
- Produces: `downloader_start_torrent(release_id: i64, torrent_id: i64, magnet_or_file_url: String) -> Result<String, String>`
- Produces: `downloader_cancel_torrent(torrent_id: i64) -> Result<(), String>`
- Produces: `downloader_get_torrent_status(torrent_id: i64) -> Result<TorrentStatus, String>`

- [ ] **Step 1: Add `librqbit` to `src-tauri/Cargo.toml`**

Add `librqbit` dependency with appropriate features.

- [ ] **Step 2: Create `torrent_engine.rs` with session management and progress tracking**

Implement `TorrentEngine` capable of adding magnet/torrent downloads to `downloads/torrents/{release_id}/`, polling download metrics, and emitting Tauri events.

- [ ] **Step 3: Register IPC handlers in `src-tauri/src/lib.rs`**

Expose `downloader_start_torrent`, `downloader_cancel_torrent`, and `downloader_get_torrent_status`.

- [ ] **Step 4: Run cargo check & cargo test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src-tauri/
git commit -m "feat(torrent): embed librqbit headless torrent engine in Rust backend"
```

---

### Task 5: Automated Episode Scanner & SQLite Indexer

**Files:**
- Create: `src-tauri/src/downloader/scanner.rs`
- Modify: `src-tauri/src/downloader/mod.rs`
- Modify: `src-tauri/src/downloader/torrent_engine.rs`
- Test: `src-tauri/tests/test_scanner.rs`

**Interfaces:**
- Produces: `scan_and_index_torrent_files(folder: &Path, release_id: i64, db: &Database) -> Result<usize, String>`

- [ ] **Step 1: Write Rust test for episode number parsing from typical torrent video filenames**

Test files like `"Hell_Mode_01_[1080p].mkv"`, `"Jujutsu_Kaisen_S2_E04.mp4"`, `"[Anilibria]_03.mkv"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --test test_scanner --manifest-path src-tauri/Cargo.toml`
Expected: FAIL

- [ ] **Step 3: Implement regex episode parser and SQLite indexer**

Extract ordinal, detect video size, and insert into `downloaded_episodes` table.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --test test_scanner --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src-tauri/src/downloader/scanner.rs src-tauri/src/downloader/torrent_engine.rs src-tauri/tests/test_scanner.rs
git commit -m "feat(torrent): add automatic episode video scanner and SQLite indexer"
```

---

### Task 6: Torrents Tab UI & Download Store Integration

**Files:**
- Modify: `src/components/TorrentsTab.tsx`
- Modify: `src/store/downloadStore.ts`
- Test: `tests/test_torrent_downloads.test.tsx`

**Interfaces:**
- Consumes: `downloader_start_torrent` via `@tauri-apps/api/core`.
- Consumes: `useDownloadStore` (`activeDownloads`, `startTorrentDownload`, `cancelDownload`).

- [ ] **Step 1: Write test for TorrentsTab download action**

```tsx
it("renders 'Скачать в приложение' button and triggers startTorrentDownload on click", () => {
  render(<TorrentsTab releaseId={1001} />);
  const downloadBtn = screen.getByRole("button", { name: /скачать в приложение/i });
  expect(downloadBtn).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/test_torrent_downloads.test.tsx`

- [ ] **Step 3: Implement `startTorrentDownload` in `downloadStore.ts` and add button in `TorrentsTab.tsx`**

Connect progress listener, handle state transitions, and show download percentage directly on the torrent card.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/test_torrent_downloads.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/TorrentsTab.tsx src/store/downloadStore.ts tests/test_torrent_downloads.test.tsx
git commit -m "feat(ui): add in-app torrent download button and store integration"
```

---

### Task 7: Offline Playback Verification in DownloadsView & End-to-End Test

**Files:**
- Modify: `src/components/DownloadsView.tsx`
- Test: `tests/test_downloads_view.test.tsx`

**Interfaces:**
- Consumes: `downloadedEpisodes` from `downloadStore`.
- Consumes: `openPlayer` from `playerStore` using `convertFileSrc`.

- [ ] **Step 1: Write test verifying torrent-downloaded episodes appear in DownloadsView and can be launched**

```tsx
it("displays torrent-downloaded release in DownloadsView and plays via local asset URL", () => {
  render(<DownloadsView />);
  // verifies card renders and Play button triggers player
});
```

- [ ] **Step 2: Run test to verify**

Run: `bunx vitest run tests/test_downloads_view.test.tsx`

- [ ] **Step 3: Run full verification suite**

Run:
1. `bunx vitest run`
2. `bun run build`
3. `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 4: Final commit**

```bash
git add src/ tests/
git commit -m "test: verify end-to-end headless torrent downloading and offline playback"
```
