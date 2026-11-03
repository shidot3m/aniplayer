# Aniplayer

Десктопный аниме-плеер для Windows: Tauri 2 + React 19, воспроизведение через встроенный mpv (любые кодеки и контейнеры, ничего ставить не нужно), апскейл Anime4K через GLSL-цепочку mpv, каталог AniLiberty, торрент-загрузки и скачивание серий.

## Возможности

- Любое видео играет встроенный mpv-процесс (JSON IPC): HEVC Main 10, AV1, VP9, Opus, DTS/AC3, MPEG-2/VC-1, любой контейнер — даже там, где Windows без кодеков показывает чёрный экран; онлайн-HLS, офлайн-плейлисты и скачанные файлы — одним путём ([ADR 0010](docs/adr/0010-mpv-subprocess-as-the-only-playback-backend.md))
- Anime4K-апскейл в реальном времени GLSL-шейдерами mpv с пресетами и сохранением выбора; аппаратное декодирование используется, когда оно есть (hwdec=auto-safe)
- Каталог, расписание, жанры, франшизы — API AniLiberty
- Торрент-загрузки через встроенный движок `librqbit` со сканированием серий после завершения: скачанный файл играется как есть, контейнер и кодеки больше не важны
- Скачивание серий, отслеживание активных загрузок с отменой, плавающий виджет прогресса
- Закладки, «Продолжить просмотр», история — SQLite (`data/aniplayer.db` рядом с exe)

## Стек

| Слой         | Технологии                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| UI           | React 19, TypeScript 7, Vite 8, Tailwind 4, Zustand, Radix UI, lucide-react |
| Оболочка     | Tauri 2.12 (Rust, edition 2021)                                             |
| Бэкенд       | Tauri IPC: `librqbit` 9, `rusqlite` 0.41, `reqwest` 0.13, supervisor mpv    |
| Плеер        | bundled mpv `v0.41.0` (отдельный процесс, JSON IPC по named pipe)           |
| Тесты / линт | Vitest 5, Testing Library, Biome 2.6, aislop                                |

## Требования

- Windows 10/11 x64
- [Node.js](https://nodejs.org/) 26 LTS и npm
- [Rust](https://rustup.rs/) (stable, `x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) с C++ (для `rusqlite`/Tauri)
- WebView2 Runtime (в Windows 11 уже есть)
- Python 3 — только для portable-упаковки

## Установка (portable)

Единственный публикуемый артефакт — `Aniplayer-portable.zip` из релиза [`latest`](../../releases/tag/latest):

1. Распакуйте архив в папку, доступную на запись (не `Program Files`).
2. Запустите `aniplayer.exe`. Плеер (`mpv/`) и шейдеры (`shaders/`) уже в архиве — ничего доустанавливать не нужно. База создаётся в `data/aniplayer.db`, загрузки — в `downloads/`.
3. Для обновления замените файлы программы, сохранив `data/` и `downloads/`.

Установщиков нет; база, загрузки и настройки остаются внутри папки. Служебный кэш
WebView2 Tauri по умолчанию держит в `%LOCALAPPDATA%`. Подробности — в
[ADR 0006](docs/adr/0006-portable-only-distribution.md).

## Запуск

```bash
npm ci
python scripts/get_mpv.py src-tauri/target/debug/mpv   # плеер для dev-сборки (кэш в .cache/)
npm run tauri dev
```

Фронтенд отдельно (без окна Tauri): `npm run dev` — http://127.0.0.1:1420; там плеера нет, каталог работает.

В Git Bash / MSYS-шеллах Rust не линкуется: `usr/bin/link.exe` из Git перекрывает
линкер MSVC, а `INCLUDE`/`LIB` не экспортируются. Для этих шеллов есть `npm run
tauri:win` — он подгружает окружение Visual Studio через `vsdevcmd.bat`
(`scripts/tauri-win.cmd`) и передаёт аргументы в `tauri`:

```bash
npm run tauri:win dev
```

## Сборка

```bash
npx tauri build --no-bundle           # aniplayer.exe в src-tauri/target/release
python scripts/get_mpv.py src-tauri/target/release/mpv
python scripts/package_portable.py    # portable-папка: aniplayer.exe + mpv/ + shaders/ + пустая data/
```

Релизный workflow скачивает pinned mpv-сборку и сверяет её SHA-256 (`scripts/get_mpv.py`), собирает ту же папку, упаковывает в `Aniplayer-portable.zip` и проверяет наличие `aniplayer.exe`, `mpv/mpv.exe` и Anime4K-шейдеров. Бандлы MSI/NSIS не публикуются.

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную и выполняет только быстрые проверки: типы, Biome, Vitest, aislop, сборку фронтенда, а также `cargo fmt --check`, clippy с запретом предупреждений, аудит зависимостей и герметичные Rust-тесты (`test_db`, `test_hls_playlist`, `test_magnet_validation`, `test_player`, `test_scanner`, `test_security_config`, `test_startup`, `test_torrent_path_validation`). Любая сломанная проверка роняет CI. Релизные сборки здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию (03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`. Каждый запуск собирает Windows portable-сборку и публикует единственный артефакт:

- `Aniplayer-portable.zip` — `aniplayer.exe`, runtime плеера `mpv/`, `shaders/anime4k/` и пустая папка `data/` (база создаётся при первом запуске).

Ночные и ручные сборки обновляют rolling-релиз [`latest`](../../releases/tag/latest) и перемещают тег `latest` на собранный коммит. Теги `v*` публикуют отдельный версионированный релиз и не меняют `latest`. Отдельного `Aniplayer.exe` в релизах нет.

## Тесты и качество кода

```bash
npm run typecheck   # типы: src, tests и конфиги сборки
npm run lint        # Biome (линт + форматирование)
npm run test        # Vitest
npm run build       # tsc + vite build
npm run check       # typecheck + Biome + Vitest + aislop
```

Rust-проверки (из каталога `src-tauri`, с окружением MSVC):

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo audit
cargo test --locked --test test_db --test test_hls_playlist --test test_magnet_validation \
  --test test_player \
  --test test_scanner --test test_security_config --test test_startup \
  --test test_torrent_path_validation
```

`test_api` обращается к живому API AniLiberty и поэтому в CI не входит.

## Структура

```
src/app/             Оболочка приложения: композиция фичер (App, Header)
src/features/        Фичеры: catalog, release, continue-watching, player, downloads, bookmarks, settings
src/shared/          Общие ui-компоненты, утилиты и доменные типы (ui/lib/types)
src-tauri/           Rust-бэкенд: API-клиент, БД, загрузки и торренты, supervisor mpv, IPC-команды
tests/               фронтенд-тесты (Vitest); границы фичер проверяет test_feature_boundaries.test.ts
scripts/             скачивание pinned mpv, portable-упаковка, запуск Tauri и cargo из MSYS-шеллов
docs/                архитектура, ADR, схема AniLiberty API, заметки по Anime4K, инструкции для агентов
shaders/anime4k/     GLSL-шейдеры Anime4K, которые mpv прогоняет цепочкой
GLOSSARY.md          доменный словарь
AGENTS.md            правила работы агентов
data/, downloads/    локальные БД и загрузки (не в git)
```

Границы фичер и потоки данных описаны в [docs/architecture.md](docs/architecture.md),
термины — в [GLOSSARY.md](GLOSSARY.md), правила работы агентов — в [AGENTS.md](AGENTS.md).
