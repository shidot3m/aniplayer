# Aniplayer

Десктопный аниме-плеер для Windows: Tauri 2 + React 19, HLS-воспроизведение в WebView2 и апскейл Anime4K через WebGPU, каталог AniLiberty, торрент-загрузки и скачивание серий.

## Возможности

- Воспроизведение HLS через `<video>` и hls.js в WebView2; скачанные серии — офлайн-плейлист HLS с сегментами через asset protocol
- Anime4K-апскейл в реальном времени через `anime4k-webgpu` (WebGPU) с пресетами и сохранением выбора
- Каталог, расписание, жанры, франшизы — API AniLiberty
- Торрент-загрузки через встроенный движок `librqbit` со сканированием серий после завершения; MP4/WebM играет напрямую, MKV бескодово пересобирается в MP4 на лету (remux-протокол с range-запросами, вторая копия на диск не пишется)
- Разовый зонд кодеков при старте: что этот компьютер реально декодирует, решается по `mediaCapabilities`, а не по расширению файла; недекодируемое не попадает в библиотеку загрузок и объясняется на экране загрузок
- Скачивание серий, отслеживание активных загрузок с отменой, плавающий виджет прогресса
- Закладки, «Продолжить просмотр», история — SQLite (`data/aniplayer.db` рядом с exe)

## Стек

| Слой         | Технологии                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| UI           | React 19, TypeScript 7, Vite 8, Tailwind 4, Zustand, Radix UI, lucide-react |
| Оболочка     | Tauri 2.12 (Rust, edition 2021)                                             |
| Бэкенд       | Tauri IPC: `librqbit` 9, `rusqlite` 0.41, `reqwest` 0.13                    |
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
2. Запустите `aniplayer.exe`. База создаётся в `data/aniplayer.db`, загрузки — в `downloads/`.
3. Для обновления замените файлы программы, сохранив `data/` и `downloads/`.

Установщиков нет; база, загрузки и настройки остаются внутри папки. Служебный кэш
WebView2 Tauri по умолчанию держит в `%LOCALAPPDATA%`. Подробности — в
[ADR 0006](docs/adr/0006-portable-only-distribution.md).

## Запуск

```bash
npm ci
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
npx tauri build --no-bundle          # aniplayer.exe в src-tauri/target/release
python scripts/package_portable.py   # portable-папка в dist_portable (aniplayer.exe + пустая data/)
```

Релизный workflow собирает эту же папку, упаковывает её в `Aniplayer-portable.zip` и проверяет наличие `aniplayer.exe`. Бандлы MSI/NSIS не публикуются.

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную и выполняет только быстрые проверки: типы, Biome, Vitest, aislop, сборку фронтенда, а также `cargo fmt --check`, clippy с запретом предупреждений, аудит зависимостей и герметичные Rust-тесты (`test_db`, `test_hls_playlist`, `test_magnet_validation`, `test_remux`, `test_remux_service`, `test_scanner`, `test_security_config`, `test_startup`, `test_torrent_path_validation`). Любая сломанная проверка роняет CI. Релизные сборки здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию (03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`. Каждый запуск собирает Windows portable-сборку и публикует единственный артефакт:

- `Aniplayer-portable.zip` — `aniplayer.exe` и пустая папка `data/` (база создаётся при первом запуске).

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
  --test test_remux --test test_remux_service \
  --test test_scanner --test test_security_config --test test_startup \
  --test test_torrent_path_validation
```

`test_api` обращается к живому API AniLiberty и поэтому в CI не входит.

## Структура

```
src/app/             Оболочка приложения: композиция фичер (App, Header)
src/features/        Фичеры: catalog, release, continue-watching, player, downloads, bookmarks, settings
src/shared/          Общие ui-компоненты, утилиты и доменные типы (ui/lib/types)
src-tauri/           Rust-бэкенд: API-клиент, БД, загрузки и торренты, remux MKV→MP4, IPC-команды
tests/               фронтенд-тесты (Vitest); границы фичер проверяет test_feature_boundaries.test.ts
scripts/             portable-упаковка и запуск Tauri из MSYS-шеллов
docs/                архитектура, ADR, схема AniLiberty API, заметки по Anime4K, инструкции для агентов
GLOSSARY.md          доменный словарь
AGENTS.md            правила работы агентов
data/, downloads/    локальные БД и загрузки (не в git)
```

Границы фичер и потоки данных описаны в [docs/architecture.md](docs/architecture.md),
термины — в [GLOSSARY.md](GLOSSARY.md), правила работы агентов — в [AGENTS.md](AGENTS.md).
