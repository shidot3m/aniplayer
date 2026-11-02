# Aniplayer

Десктопный аниме-плеер для Windows: Tauri 2 + React 19, HLS-воспроизведение в WebView2 и апскейл Anime4K через WebGPU, каталог AniLiberty, торрент-стриминг и скачивание серий.

## Возможности

- Воспроизведение HLS через `<video>` и hls.js в WebView2, скачанных серий — через asset protocol
- Anime4K-апскейл в реальном времени через `anime4k-webgpu` (WebGPU) с пресетами и сохранением выбора
- Каталог, расписание, жанры, франшизы — API AniLiberty
- Торрент-загрузки через встроенный движок `librqbit` со сканированием серий после завершения
- Скачивание серий, очередь загрузок, виджет прогресса
- Закладки, «Продолжить просмотр», история — SQLite (`data/aniplayer.db` рядом с exe)

## Стек

| Слой         | Технологии                                                                |
| ------------ | ------------------------------------------------------------------------- |
| UI           | React 19, TypeScript, Vite 8, Tailwind 4, Zustand, Radix UI, lucide-react |
| Оболочка     | Tauri 2 (Rust 2021)                                                       |
| Бэкенд       | Tauri IPC: `librqbit`, `rusqlite`, `reqwest`                              |
| Тесты / линт | Vitest, Testing Library, Biome                                            |

## Требования

- Windows 10/11 x64
- [Node.js](https://nodejs.org/) 20+ и npm
- [Rust](https://rustup.rs/) (stable, `x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) с C++ (для `rusqlite`/Tauri)
- WebView2 Runtime (в Windows 11 уже есть)

## Запуск

```bash
npm install
npm run tauri dev
```

Фронтенд отдельно (без окна Tauri): `npm run dev` — http://127.0.0.1:1420.

В Git Bash / MSYS-шеллах Rust не линкуется: `usr/bin/link.exe` из Git перекрывает
линкер MSVC, а `INCLUDE`/`LIB` не экспортируются. Для этих шеллов есть `npm run
tauri:win` — он подгружает окружение Visual Studio через `vsdevcmd.bat`
(`scripts/tauri-win.cmd`) и передаёт аргументы в `tauri`:

```bash
npm run tauri:win dev
```

## Сборка

```bash
npm run tauri build          # бандл (msi/nsis) в src-tauri/target/release/bundle
python scripts/package_portable.py   # portable-сборка в dist_portable (aniplayer.exe + пустая data/)
```

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную и выполняет только быстрые проверки: типы, Biome, Vitest, aislop, сборку фронтенда, а также `cargo fmt --check`, clippy с запретом предупреждений, аудит зависимостей и герметичные Rust-тесты (`test_db`, `test_magnet_validation`, `test_scanner`, `test_security_config`, `test_startup`, `test_torrent_path_validation`). Любая сломанная проверка роняет CI. Релизные сборки здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию (03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`. Каждый запуск собирает Windows portable-сборку и публикует единственный артефакт:

- `Aniplayer-portable.zip` — `aniplayer.exe` и пустая папка `data/` (база создаётся при первом запуске).

Ночные и ручные сборки обновляют rolling-релиз [`latest`](../../releases/tag/latest) и перемещают тег `latest` на собранный коммит. Теги `v*` публикуют отдельный версионированный релиз и не меняют `latest`. Отдельного `Aniplayer.exe` в релизах нет.

## Тесты и качество кода

```bash
npm run typecheck   # типы: src, tests и конфиги сборки
npm run lint        # Biome (линт + форматирование)
npm run test        # Vitest
npm run check       # все быстрые проверки фронтенда + aislop
```

Rust-проверки (из каталога `src-tauri`, с окружением MSVC):

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo audit
cargo test --locked --test test_db --test test_magnet_validation --test test_scanner \
  --test test_security_config --test test_startup --test test_torrent_path_validation
```

## Структура

```
src/app/             Оболочка приложения: композиция фичер (App, Header)
src/features/        Фичеры: catalog, release, continue-watching, player, downloads, bookmarks, settings
src/shared/          Общие ui-компоненты, утилиты и доменные типы (ui/lib/types)
src-tauri/           Rust-бэкенд: торренты, БД, API-клиент, IPC-команды
scripts/             portable-упаковка
docs/                выгрузка схемы AniLiberty API
tests/               тесты фронтенда
data/, downloads/    локальные БД и загрузки (не в git)
```
