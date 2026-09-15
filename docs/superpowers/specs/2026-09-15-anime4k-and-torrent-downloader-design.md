# Anime4K Presets Separation & Embedded Headless BitTorrent Client Design

**Date:** 2026-09-15  
**Status:** Approved  
**Author:** Antigravity  

---

## 1. Executive Summary & Goals

This specification addresses two key user requirements for **Aniplayer**:
1. **Anime4K Preset Management Separation:**
   - Eliminate mock SVG filter implementations.
   - Present the complete catalog of 7 official Anime4K v4 presets with human-readable descriptions in the application Settings (`SettingsDialog` -> `PlaybackTab`).
   - In the video player overlay (`SettingsMenu`), simplify the control to a single toggle: **Anime4K Upscaler [Вкл / Выкл]**, which dynamically applies the preset configured in the application settings without in-player menu clutter.
2. **Embedded Headless BitTorrent Subsystem:**
   - Integrate an in-process, headless BitTorrent downloading engine into the Rust backend (`src-tauri`) using `librqbit`.
   - Provide a "Скачать торрент (в фоне)" action in the release's Torrents tab (`TorrentsTab.tsx`), downloading the entire multi-file release directly to disk (`downloads/torrents/{release_id}/`).
   - Emit live download progress events (`download-progress`) to the frontend for the floating download widget (`DownloadFloatingWidget`) and state store (`downloadStore`).
   - On download completion, automatically inspect video files (`.mkv`, `.mp4`), match episode ordinals, and index them into Aniplayer's SQLite database (`download_meta`).
   - Enable full offline playback in the «Скачанные» (`DownloadsView`) section via Tauri's asset streaming protocol (`convertFileSrc`).

---

## 2. Subsystem 1: Anime4K Preset Configuration

### 2.1 Presets Specification

The system defines 7 official Anime4K v4 presets:
1. **Mode A (HQ)** — `Mode A (HQ)`: Blur reduction and edge reconstruction. Ideal for clean 1080p anime.
2. **Mode A+A (HQ)** — `Mode A+A (HQ)`: High quality blur reduction with two-pass CNN line reconstruction. Maximum clarity for high-end GPUs (Default).
3. **Mode B (HQ)** — `Mode B (HQ)`: Denoise + soft line reconstruction. Ideal for 720p/1080p with compression artifacts.
4. **Mode B+B (HQ)** — `Mode B+B (HQ)`: Enhanced denoise and soft reconstruction for heavily artifacted streams.
5. **Mode C (HQ)** — `Mode C (HQ)`: Heavy artifact removal and denoise. Ideal for degraded sources, DVD rips, and 480p anime.
6. **Mode C+A (HQ)** — `Mode C+A (HQ)`: Heavy denoise + Mode A sharp edge reconstruction.
7. **Mode Fast (APU / iGPU)** — `Mode Fast (APU)`: Lightweight CNN upscaling optimized for integrated graphics (APUs, Intel Iris, low-power GPUs).

### 2.2 Data Layer & State Management

- **Types (`src/types/index.ts`):**
  ```typescript
  export interface Anime4kPresetItem {
    id: string;
    label: string;
    description: string;
    tier: "HQ" | "Fast";
  }
  ```
- **Defaults & Constants (`src/store/playerStoreDefaults.ts`):**
  Export `ANIME4K_PRESET_OPTIONS: Anime4kPresetItem[]`.
- **Player Store (`src/store/playerStore.ts`):**
  - `anime4kPreset`: string (loaded from SQLite key `"anime4k_preset"`, default `"Mode A+A (HQ)"`).
  - `anime4kEnabled`: boolean (loaded from SQLite key `"anime4k_enabled"`, default `true`).
  - `setAnime4kPreset(preset: string)`: Updates store, calls `db_save_setting("anime4k_preset", preset)`, and if running native player, calls `player_set_shader_preset(preset)`.
  - `toggleAnime4k()`: Toggles boolean state, persists to SQLite, and applies/clears shaders.

### 2.3 UI Separation

1. **Application Settings (`src/components/settings/PlaybackTab.tsx`):**
   - Renders a 7-item interactive card grid showing title, tier badge, and usage description for each preset.
   - Lets the user pick their default preferred preset.
2. **Video Player (`src/components/player/SettingsMenu.tsx`):**
   - Clean UI: A simple switch labeled `Апскейлер Anime4K [Вкл/Выкл]`.
   - Displays subtitle with the currently active preset name (e.g., `Активен: Mode A+A (HQ)`), with no dropdown clutter.
3. **Video Viewport (`src/components/player/PlayerVideoViewport.tsx`):**
   - Cleans up the mock SVG `feConvolveMatrix` filter.
   - When `anime4kEnabled` is true, applies CSS sharpness and hardware acceleration hints, or passes shader state to the underlying native engine.

---

## 3. Subsystem 2: Embedded Headless BitTorrent Engine

### 3.1 Rust Engine Architecture (`src-tauri`)

- **Crate:** `librqbit` integrated into `src-tauri/Cargo.toml`.
- **Module Structure (`src-tauri/src/downloader/torrent_engine.rs`):**
  ```rust
  pub struct TorrentEngine {
      session: Arc<librqbit::Session>,
      db: Arc<Database>,
      app_handle: tauri::AppHandle,
      active_tasks: Arc<Mutex<HashMap<i64, tokio::task::JoinHandle<()>>>>,
  }
  ```
- **Lifecycle & Background Worker:**
  1. `TorrentEngine::new(download_dir: PathBuf, db: Arc<Database>, app_handle: AppHandle) -> Self`.
  2. Spawns session on Tokio runtime.
  3. `start_download(release_id: i64, torrent_id: i64, magnet_or_file_url: String) -> Result<(), String>`:
     - Downloads the torrent / magnet into `downloads/torrents/{release_id}/`.
     - Polls progress every 500ms and emits `download-progress` event to frontend:
       ```json
       {
         "id": "torrent-{torrent_id}",
         "release_id": 1001,
         "progress": 45.2,
         "downloaded_bytes": 104857600,
         "total_bytes": 231857600,
         "speed": 5242880,
         "peers": 24,
         "status": "DOWNLOADING"
       }
       ```
     - When finished (`progress >= 100.0` or torrent completed), triggers **Automated Episode Indexer**.
  4. `cancel_download(torrent_id: i64)`:
     - Cancels the torrent task and updates state.

### 3.2 Automated Episode Indexer

On torrent completion:
1. Walk the directory `downloads/torrents/{release_id}/` recursively.
2. Filter files with extensions: `.mkv`, `.mp4`, `.avi`.
3. For each file, extract the episode ordinal using regex patterns:
   - `(?:e|ep|серия|эпизод)[\s_.-]*(\d{1,4})`
   - `\[(\d{1,4})\]`
   - `(?:\s|^)(\d{1,3})(?:\s|\[|\.mp4|\.mkv)`
4. For each matched episode:
   - Insert or update record in SQLite table `downloaded_episodes`:
     - `episode_id`: `torrent-{release_id}-{ordinal}`
     - `release_id`: `release_id`
     - `episode_ordinal`: `ordinal`
     - `file_path`: absolute path to file
     - `file_size`: size in bytes
     - `quality`: detected quality (e.g. `"1080p"` or `"HEVC"`)
     - `download_status`: `"COMPLETED"`
5. Emit `downloads-updated` event to frontend.

### 3.3 Frontend Integration

1. **Torrents Tab (`src/components/TorrentsTab.tsx`):**
   - Add primary action button: **«Скачать торрент (в фоне)»**.
   - If torrent is already downloading or downloaded, show current status and progress bar.
2. **Download Store (`src/store/downloadStore.ts`):**
   - Handle `torrent-*` download ids seamlessly in `activeDownloads`.
   - Update `fetchDownloadedEpisodes()` to reflect newly indexed torrent episodes.
3. **Downloads View (`src/components/DownloadsView.tsx`):**
   - Displays all downloaded episodes (whether downloaded via HLS or Torrent).
   - Clicking Play on a torrent-downloaded episode opens the local file path via `convertFileSrc(meta.file_path)` in Aniplayer.

---

## 4. Verification & Testing Strategy

1. **Unit Tests (Frontend):**
   - `tests/test_anime4k_settings.test.tsx`:
     - Verifies all 7 presets render with titles and descriptions in `PlaybackTab`.
     - Verifies preset selection updates store and invokes SQLite save.
     - Verifies player `SettingsMenu` contains only the On/Off toggle.
   - `tests/test_torrent_downloads.test.tsx`:
     - Verifies torrent start triggers `downloader_start_torrent`.
     - Verifies progress events update `DownloadFloatingWidget` and `DownloadsView`.
2. **Integration Tests (Rust):**
   - Verify `librqbit` engine initializes and adds torrent/magnet tasks.
   - Verify regex episode parser correctly extracts ordinals from typical Russian/English release filenames.
   - Verify SQLite indexing records files accurately.
3. **End-to-End Build Verification:**
   - `bun run build` passes with zero errors.
   - `bunx vitest run` passes all test suites.
   - `cargo test --manifest-path src-tauri/Cargo.toml` passes all Rust tests.
