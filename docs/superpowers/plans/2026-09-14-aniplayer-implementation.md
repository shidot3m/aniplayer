# План реализации Aniplayer (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать полноценный высокопроизводительный десктопный портативный плеер Aniplayer на базе Tauri v2, Rust, React 19, Tailwind CSS, Shadcn UI и `libmpv-2.dll` с конвейером 4K-шейдеров Anime4K (A+A по умолчанию), умным пропуском опенингов и эндингов, каталогом AniLiberty, 7 категориями закладок и офлайн-скачиванием серий в формате HEVC/MP4.

**Architecture:** Двухслойная гибридная модель: Rust-бэкенд Tauri v2 управляет нативным Win32 HWND-окном видеовывода через C-FFI `libmpv-2.dll`, применяет цепочки GLSL-шейдеров Anime4K, реализует локальную БД SQLite (`data/aniplayer.db`) и многопоточный менеджер загрузок. Фронтенд на React 19 / TypeScript / Tailwind / Shadcn UI рендерит кинематографичный Dark OLED интерфейс каталога и прозрачный оверлей плеера с автоскрытием контролов.

**Tech Stack:** Tauri v2, Rust 1.80+, `libmpv-2.dll` (v2.5, `vo=gpu-next`), React 19, TypeScript, Vite, Tailwind CSS, Shadcn UI, Lucide React, SQLite (`rusqlite`), Tokio, Reqwest.

**Spec:** [docs/superpowers/specs/2026-09-14-aniplayer-design.md](file:///E:/Coding/Aniplayer/docs/superpowers/specs/2026-09-14-aniplayer-design.md)

## Global Constraints
- **Платформа:** Windows 10/11 x64 (Portable: запуск из любой папки, все файлы в `Aniplayer/`).
- **Видеоядро:** `libmpv-2.dll` с `vo=gpu-next`, `hwdec=auto-safe`, C-FFI API.
- **Шейдеры:** Каталог `shaders/anime4k/` (39 файлов v4.0.1), режим по умолчанию — **Mode A+A (HQ)**.
- **API AniLiberty:** Все запросы обязаны содержать браузерный `User-Agent` (обход 403 WAF). Данные строго мапятся на поля OpenAPI без выдуманных свойств.
- **Компоновка плеера:**
  - Слева сверху: `← Назад` + русское и японское/альтернативное названия.
  - Над таймлайном слева снизу: номер эпизода (`Серия X`).
  - Над таймлайном справа снизу: таймкоды (`08:42 / 24:15`).
  - Под таймлайном: `[К аниме]` `[Список серий]` слева, `[|◀]` `[ ▶ / ❚❚ ]` `[▶|]` по центру, `[Громкость]` `[Настройки]` `[⛶]` справа.
- **Автоматизация OP/ED:** Автопропуск и всплывающая кнопка по секундам `opening: {start, stop}`, `ending: {start, stop}`. Таймкоды кэшируются в SQLite для скачанных серий.
- **Персистентность:** Уровень громкости (0–100%) сохраняется в `app_settings` SQLite.

---

### Task 1: Инициализация проекта Tauri v2 и настройка переносимого окружения

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Test: `tests/test_scaffolding.py`

**Interfaces:**
- Consumes: `bin/mpv-dev/libmpv-2.dll`, `shaders/anime4k/*.glsl`
- Produces: Рабочее окно Tauri v2 с возможностью выполнения команд Rust из фронтенда.

- [ ] **Step 1: Write the test verifying project files and Tauri structure**
```python
# tests/test_scaffolding.py
import os


def test_project_structure():
    assert os.path.exists("src-tauri/Cargo.toml")
    assert os.path.exists("src-tauri/tauri.conf.json")
    assert os.path.exists("src-tauri/capabilities/default.json")
    assert os.path.exists("src-tauri/src/lib.rs")
    assert os.path.exists("package.json")
    assert os.path.exists("shaders/anime4k/Anime4K_Clamp_Highlights.glsl")
    assert os.path.exists("bin/mpv-dev/libmpv-2.dll")
    print("Project structure verified successfully!")


if __name__ == "__main__":
    test_project_structure()
```

- [ ] **Step 2: Run test to verify it fails initially**
```powershell
python tests/test_scaffolding.py
```

- [ ] **Step 3: Initialize npm packages, Vite React-TS and Tauri v2 backend**
  - Настроить `package.json` с зависимостями `@tauri-apps/api`, `@tauri-apps/plugin-shell`, `react`, `react-dom`, `lucide-react`, `zustand`.
  - Настроить `src-tauri/Cargo.toml` с `tauri = { version = "2", features = [] }`, `serde`, `serde_json`, `rusqlite`, `tokio`, `reqwest`.
  - Создать `src-tauri/capabilities/default.json` с правами `core:default`.
  - В `src-tauri/src/lib.rs` реализовать базовый `pub fn run()` и команду `ping`.
  - В `src-tauri/src/main.rs` оставить тонкий вызов `app_lib::run()`.

- [ ] **Step 4: Run tests and verify build sanity**
```powershell
python tests/test_scaffolding.py
cargo check --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 5: Commit scaffolding**

---

### Task 2: Движок локальной БД SQLite (Закладки, История, Офлайн, Настройки)

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/schema.sql`
- Create: `src-tauri/src/db/repository.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/test_db.rs`

**Interfaces:**
- Consumes: Портативный путь `data/aniplayer.db`.
- Produces:
  - `db_save_bookmark(release_id: i64, category: String, release_data_json: String) -> Result<(), String>`
  - `db_get_bookmarks(category: Option<String>) -> Result<Vec<BookmarkItem>, String>`
  - `db_save_history(release_id: i64, episode_id: String, ordinal: f64, pos: f64, duration: f64, completed: bool) -> Result<(), String>`
  - `db_get_continue_watching() -> Result<Vec<HistoryItem>, String>`
  - `db_save_setting(key: String, value: String) -> Result<(), String>`
  - `db_get_setting(key: String) -> Result<Option<String>, String>`
  - `db_save_download_meta(episode_id: String, release_id: i64, ordinal: f64, path: String, op_start: Option<f64>, op_stop: Option<f64>, ed_start: Option<f64>, ed_stop: Option<f64>) -> Result<(), String>`

- [ ] **Step 1: Write Rust integration tests for SQLite repository**
```rust
// src-tauri/tests/test_db.rs
#[test]
fn test_sqlite_repository_crud() {
    let repo = aniplayer_lib::db::repository::Database::init_in_memory().unwrap();
    repo.save_setting("volume", "75").unwrap();
    assert_eq!(repo.get_setting("volume").unwrap(), Some("75".to_string()));

    repo.save_bookmark(10239, "WATCHING", "{\"title\":\"Test\"}").unwrap();
    let bookmarks = repo.get_bookmarks(Some("WATCHING".to_string())).unwrap();
    assert_eq!(bookmarks.len(), 1);
    assert_eq!(bookmarks[0].release_id, 10239);
}
```

- [ ] **Step 2: Run test to make sure it fails**
```powershell
cargo test --test test_db --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 3: Implement Database struct, migrations and CRUD methods**
  - Подключить `rusqlite` с включенной фичей `bundled`.
  - Создать таблицы `bookmarks`, `history`, `downloaded_episodes`, `app_settings`.
  - Реализовать методы с обработкой ошибок `Result<T, AppError>`.
  - Зарегистрировать команды в `generate_handler![]` в `lib.rs`.

- [ ] **Step 4: Run tests and verify they pass**
```powershell
cargo test --test test_db --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 5: Commit database module**

---

### Task 3: Сетевой клиент AniLiberty API и менеджер загрузок (HLS & HEVC)

**Files:**
- Create: `src-tauri/src/api/mod.rs`
- Create: `src-tauri/src/api/client.rs`
- Create: `src-tauri/src/api/models.rs`
- Create: `src-tauri/src/downloader/mod.rs`
- Create: `src-tauri/src/downloader/hls.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/test_api.rs`

**Interfaces:**
- Consumes: Сеть интернет (`https://aniliberty.top/api/v1`), SQLite БД.
- Produces:
  - `api_get_latest_releases(limit: u32) -> Result<Vec<ReleasePreview>, String>`
  - `api_get_schedule_week() -> Result<WeekSchedule, String>`
  - `api_get_genres() -> Result<Vec<Genre>, String>`
  - `api_get_release(id_or_alias: String) -> Result<ReleaseDetails, String>`
  - `api_get_release_torrents(release_id: i64) -> Result<Vec<TorrentItem>, String>`
  - `api_search_releases(query: String) -> Result<Vec<ReleasePreview>, String>`
  - `download_start_episode(episode_id: String, release_id: i64, ordinal: f64, m3u8_url: String, op: Option<SkipInterval>, ed: Option<SkipInterval>) -> Result<(), String>`

- [ ] **Step 1: Write integration tests for API client and HLS parser**
```rust
// src-tauri/tests/test_api.rs
#[tokio::test]
async fn test_api_fetch_and_user_agent() {
    let client = aniplayer_lib::api::client::AnilibriaClient::new();
    let status = client.get_status().await.unwrap();
    assert!(status.is_alive);

    let release = client.get_release("10239").await.unwrap();
    assert!(!release.episodes.is_empty());
    assert!(release.episodes[0].hls_1080.is_some());
}
```

- [ ] **Step 2: Run test to make sure it fails**
```powershell
cargo test --test test_api --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 3: Implement Reqwest client with custom User-Agent and HLS Downloader**
  - Добавить заголовки `User-Agent: Mozilla/5.0 Aniplayer/1.0`.
  - Реализовать десериализацию моделей AniLiberty OpenAPI.
  - Реализовать асинхронный воркер скачивания TS сегментов и склейки в `.mp4` с сохранением в `downloads/`.
  - Сохранять таймкоды `opening`/`ending` в SQLite при загрузке.

- [ ] **Step 4: Run tests and verify they pass**
```powershell
cargo test --test test_api --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 5: Commit API and downloader modules**

---

### Task 4: Видеоядро libmpv, нативный HWND-рендерер и конвейер Anime4K

**Files:**
- Create: `src-tauri/src/player/mod.rs`
- Create: `src-tauri/src/player/mpv.rs`
- Create: `src-tauri/src/player/ffi.rs`
- Create: `src-tauri/src/player/shaders.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/test_player.rs`

**Interfaces:**
- Consumes: `bin/mpv-dev/libmpv-2.dll`, `shaders/anime4k/*.glsl`, Win32 HWND.
- Produces:
  - `player_init(hwnd: usize) -> Result<(), String>`
  - `player_load_video(url: String, start_pos: f64) -> Result<(), String>`
  - `player_play() -> Result<(), String>`
  - `player_pause() -> Result<(), String>`
  - `player_seek(pos: f64) -> Result<(), String>`
  - `player_set_volume(vol: f64) -> Result<(), String>`
  - `player_set_speed(speed: f64) -> Result<(), String>`
  - `player_set_shader_preset(preset: String) -> Result<(), String>`
  - События Tauri: `player://time-pos`, `player://duration`, `player://paused`, `player://eof`.

- [ ] **Step 1: Write integration tests for MPV FFI and shader loading**
```rust
// src-tauri/tests/test_player.rs
#[test]
fn test_mpv_instance_and_shader_preset() {
    let mut player = aniplayer_lib::player::mpv::MpvCore::new_test_headless().unwrap();
    player.set_shader_preset("A+A").unwrap();
    let active_shaders = player.get_property_string("glsl-shaders").unwrap();
    assert!(active_shaders.contains("Anime4K_Clamp_Highlights.glsl"));
    assert!(active_shaders.contains("Anime4K_Restore_CNN_VL.glsl"));
}
```

- [ ] **Step 2: Run test to make sure it fails**
```powershell
cargo test --test test_player --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 3: Implement libmpv FFI bindings and Shader Manager**
  - Подключить `libmpv-2.dll` через безопасные C-вызовы (`mpv_create`, `mpv_set_option_string`, `mpv_command_async`, `mpv_observe_property`).
  - Настроить опции: `vo=gpu-next`, `hwdec=auto-safe`, `gpu-api=auto`, привязка `wid=HWND`.
  - Реализовать словарь пресетов: `A+A` (по умолчанию), `A`, `B`, `B+B`, `C`, `C+A`, `Fast APU`, `Off`.
  - Запустить фоновый поток `mpv_wait_event` с эмиттингом событий в вебвью.

- [ ] **Step 4: Run tests and verify they pass**
```powershell
cargo test --test test_player --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 5: Commit player and shader engine**

---

### Task 5: Фронтенд: Дизайн-система, Shadcn UI и State-менеджмент

**Files:**
- Create: `src/index.css`
- Create: `src/types/index.ts`
- Create: `src/store/playerStore.ts`
- Create: `src/store/catalogStore.ts`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/slider.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/badge.tsx`
- Test: `tests/test_frontend_state.test.ts`

**Interfaces:**
- Consumes: `@tauri-apps/api/core`, `zustand`, `lucide-react`.
- Produces: Типобезопасные хранилища состояния и базовые компоненты Shadcn UI в теме Dark OLED.

- [ ] **Step 1: Write frontend state test (Vitest/Jest)**
```typescript
// tests/test_frontend_state.test.ts
import { describe, it, expect } from 'vitest';
import { usePlayerStore } from '../src/store/playerStore';

describe('PlayerStore', () => {
  it('should initialize with default Anime4K A+A preset and stored volume', () => {
    const state = usePlayerStore.getState();
    expect(state.anime4kPreset).toBe('A+A');
    expect(state.anime4kEnabled).toBe(true);
    expect(state.volume).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```powershell
npx vitest run tests/test_frontend_state.test.ts
```

- [ ] **Step 3: Implement Tailwind design tokens, Shadcn primitives and Zustand stores**
  - Подключить переменные палитры Dark OLED (`#090A0F`, `#12131A`, `#E11D48`, `#6366F1`).
  - Сгенерировать компоненты `Button`, `Slider`, `Tabs`, `DropdownMenu`, `Dialog`, `Badge` с помощью MCP-инструментов `shadcn`.
  - Реализовать `playerStore.ts` (синхронизация `currentTime`, `duration`, `volume`, `isPlaying`, `skipIntervals`, `preset`).
  - Реализовать `catalogStore.ts` (закладки, история, поиск, текущий выбранный экран).

- [ ] **Step 4: Run tests and verify they pass**
```powershell
npx vitest run tests/test_frontend_state.test.ts
```

- [ ] **Step 5: Commit design system and stores**

---

### Task 6: UI Каталога: Верхняя панель, Главный экран, Карточки и Закладки

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/AnimeCard.tsx`
- Create: `src/components/ContinueWatching.tsx`
- Create: `src/components/ReleaseSchedule.tsx`
- Create: `src/components/GenreSelector.tsx`
- Create: `src/components/BookmarksView.tsx`
- Create: `src/components/ReleaseDetails.tsx`
- Modify: `src/App.tsx`
- Test: `tests/test_catalog_ui.test.tsx`

**Interfaces:**
- Consumes: `catalogStore`, IPC команды `api_*`, `db_*`.
- Produces: Полный интерфейс навигации по аниме с поддержкой 7 категорий закладок и детальной страницы.

- [ ] **Step 1: Write UI component tests for AnimeCard and Bookmarks**
```typescript
// tests/test_catalog_ui.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimeCard } from '../src/components/AnimeCard';

describe('AnimeCard', () => {
  it('renders correctly with API fields without fallback artifacts', () => {
    const release = {
      id: 10239,
      name: { main: 'Адский режим', english: 'Hell Mode', alternative: 'ヘルモード' },
      type: { description: 'ТВ' },
      episodes_total: 12,
      poster: { src: '/poster.jpg' }
    };
    render(<AnimeCard release={release as any} onClick={() => {}} />);
    expect(screen.getByText('Адский режим')).toBeDefined();
    expect(screen.getByText('ТВ')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to make sure it fails**
```powershell
npx vitest run tests/test_catalog_ui.test.tsx
```

- [ ] **Step 3: Implement Header, AnimeCard, Home sections, Bookmarks and Details**
  - **Header:** Поиск с дебаунсом 300 мс, кнопка «Закладки» со счетчиком, кнопка «Настройки».
  - **Home:** Блок «Продолжить просмотр» с прогресс-баром, «Новые эпизоды», «Расписание релизов» по дням недели, сетка жанров.
  - **AnimeCard:** Пропорции 2:3, аккуратное скругление `rounded-xl`, hover с затемнением градиентом, названиями, типом и быстрой закладкой.
  - **BookmarksView:** 7 табов со счетчиками (`WATCHING`, `PLANNED`, `POSTPONED`, `ABANDONED`, `NOT_INTERESTED`, `FAVORITES`, `WATCHED`), поиск и фильтры.
  - **ReleaseDetails:** Шапка релиза (постер, русское/английское/японское названия, бейджи: тип, жанры, год, длительность серии, число эпизодов, общее время, кнопка «Смотреть с 1 серии»). Табы «Эпизоды» (с меню действий `...`) и «Связанное» (франшизы).

- [ ] **Step 4: Run tests and verify they pass**
```powershell
npx vitest run tests/test_catalog_ui.test.tsx
```

- [ ] **Step 5: Commit catalog and details UI**

---

### Task 7: Оверлей видеоплеера: Утвержденная компоновка, автопропуск OP/ED и 4K-фильтры

**Files:**
- Create: `src/components/player/PlayerOverlay.tsx`
- Create: `src/components/player/SeekBar.tsx`
- Create: `src/components/player/ControlsBar.tsx`
- Create: `src/components/player/EpisodeDrawer.tsx`
- Create: `src/components/player/SettingsMenu.tsx`
- Create: `src/components/player/SkipToast.tsx`
- Modify: `src/App.tsx`
- Test: `tests/test_player_overlay.test.tsx`

**Interfaces:**
- Consumes: `playerStore`, Rust IPC события и команды `player_*`.
- Produces: Полноэкранный плеер с автоскрытием контролов (2.5 с), автопропуском OP/ED, переключением пресетов Anime4K и сохранением громкости.

- [ ] **Step 1: Write UI tests for player layout and controls**
```typescript
// tests/test_player_overlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerOverlay } from '../src/components/player/PlayerOverlay';

describe('PlayerOverlay Layout', () => {
  it('places episode number above seekbar and controls in proper positions', () => {
    render(<PlayerOverlay />);
    // Check back arrow and titles top-left
    expect(screen.getByTestId('player-back-btn')).toBeDefined();
    // Episode number above timeline
    expect(screen.getByTestId('player-episode-badge-above-timeline')).toBeDefined();
    // Timecodes above timeline right
    expect(screen.getByTestId('player-timecodes-above-timeline')).toBeDefined();
    // Center playback buttons
    expect(screen.getByTestId('player-play-pause-btn')).toBeDefined();
    expect(screen.getByTestId('player-prev-btn')).toBeDefined();
    expect(screen.getByTestId('player-next-btn')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to make sure it fails**
```powershell
npx vitest run tests/test_player_overlay.test.tsx
```

- [ ] **Step 3: Implement PlayerOverlay and Controls**
  - **Верх слева:** Стрелка `← Назад` + русское (`release.name.main`) и японское/альтернативное названия.
  - **Над таймлайном слева:** Номер эпизода (`Серия X`).
  - **Над таймлайном справа:** Таймкоды `08:42 / 24:15`.
  - **Таймлайн:** Интерактивный слайдер `SeekBar` с буферизацией и тултипом времени.
  - **Под таймлайном:**
    - Слева: `[К аниме]` и `[Список серий]` (открывает `EpisodeDrawer`).
    - По центру: `[|◀]` (Предыдущая), `[ ▶ / ❚❚ ]` (Play/Pause), `[▶|]` (Следующая).
    - Справа: Ползунок громкости (иконка + слайдер с сохранением в SQLite), `[⚙]` (SettingsMenu: выбор HLS качества, скорость, тумблер Anime4K с выбором пресета [A+A по умолчанию], автопропуск OP/ED, автовоспроизведение), `[⛶]` (Fullscreen).
  - **Автоскрытие:** Скрытие оверлея через 2.5 сек бездействия курсора.
  - **Автопропуск OP/ED:** Автоматический seek с `opening.start` на `opening.stop` (и для `ending`), либо появление всплывающей плашки `[Пропустить опенинг (S)]`.
  - **Автовоспроизведение:** Тост за 15 сек до конца серии с обратным отсчетом.

- [ ] **Step 4: Run tests and verify they pass**
```powershell
npx vitest run tests/test_player_overlay.test.tsx
```

- [ ] **Step 5: Commit player overlay components**

---

### Task 8: Сквозная интеграция, E2E тестирование и сборка Portable-пакета

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`
- Create: `tests/e2e_player_flow.py`
- Test: `tests/preflight_sanity_test.py`

**Interfaces:**
- Consumes: Все компоненты бэкенда и фронтенда.
- Produces: Автономный рабочий дистрибутив `Aniplayer/` с `aniplayer.exe`, `libmpv-2.dll`, `shaders/anime4k/`, `data/aniplayer.db`.

- [ ] **Step 1: Write E2E flow test script**
```python
# tests/e2e_player_flow.py
import subprocess
import os


def test_full_sanity():
    res = subprocess.run(
        ["python", "tests/preflight_sanity_test.py"], capture_output=True, text=True
    )
    assert res.returncode == 0
    assert "ALL 4 SANITY CHECKS PASSED" in res.stdout
    print("E2E pre-flight sanity passed!")


if __name__ == "__main__":
    test_full_sanity()
```

- [ ] **Step 2: Run test to verify dependencies are healthy**
```powershell
python tests/e2e_player_flow.py
```

- [ ] **Step 3: Assemble portable build scripts and verify integration**
  - Добавить скрипт копирования `libmpv-2.dll` и `shaders/anime4k/` в целевой каталог сборки.
  - Проверить сохранение и восстановление громкости между сессиями.
  - Проверить переключение пресетов Anime4K в реальном плеере.
  - Проверить скачивание серии и воспроизведение из локального кэша `downloads/` с автопропуском опенинга.

- [ ] **Step 4: Run full build and test suite**
```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
python tests/e2e_player_flow.py
```

- [ ] **Step 5: Final commit and packaging verification**
