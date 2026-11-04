# Aniplayer

Десктопный аниме-плеер для Windows: Tauri 2 + React 19. Видео играет сам webview — медиаэлемент `<video>`, которому HLS (онлайн-URL или скачанный Offline playlist) подаёт hls.js через Media Source Extensions; контролы лежат поверх кадра React-оверлеем. Каталог AniLiberty, скачивание серий, апскейл Anime4K.

## Возможности

- Один оконный слой: серия играет прямо в интерфейсе, без второго окна, прозрачной дырки и topmost-стека ([ADR 0014](docs/adr/0014-webview-is-the-only-playback-backend.md))
- Скачанный эпизод играется с диска без сети: playlist и сегменты отдаёт asset-протокол, ограниченный папкой `downloads/`
- Переключение Quality (480p/720p/1080p) на живом воспроизведении — без перезапуска сессии и без потери позиции
- Продолжение просмотра, автопропуск опенинга/эндинга, автопереход к следующей серии
- Anime4K: пресеты и тумблер в настройках; в webview их прогоняет WebGPU-рендерер ([#61](https://github.com/shidot3m/aniplayer/issues/61))
- Каталог, расписание, жанры, франшизы — API AniLiberty
- Скачивание серий через HLS — единственный путь получения серии: одна серия или весь релиз, отслеживание активных загрузок с отменой, плавающий виджет прогресса
- Закладки, «Продолжить просмотр», история — SQLite (`data/aniplayer.db` рядом с exe)

## Стек

| Слой         | Технологии                                                                      |
| ------------ | ------------------------------------------------------------------------------- |
| UI           | React 19, TypeScript 7, Vite 8, Tailwind 4, Zustand, Radix UI, lucide-react     |
| Плеер        | `<video>` + hls.js 1.7 (MSE) внутри webview Tauri                               |
| JS-тулчейн   | Bun 1.4.4 (установщик, рантайм и запуск скриптов; ADR 0011)                     |
| Оболочка     | Tauri 2.12 (Rust, edition 2021), asset-протокол на папку загрузок               |
| Бэкенд       | Tauri IPC: `rusqlite` 0.41, `reqwest` 0.13, HLS-загрузчик, вердикт об источнике |
| Тесты / линт | Vitest 5, Testing Library, Biome 2.6, aislop                                    |

Медиа-рантайм в архиве не нужен: декодирует WebView2, а он есть в Windows 10/11 (в Windows 11 — из коробки).

## Требования

- Windows 10/11 x64
- [Bun](https://bun.sh/) 1.4.4 — единственный JS-тулчейн проекта; Node.js и npm не нужны
- [Rust](https://rustup.rs/) (stable, `x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) с C++ (для `rusqlite`/Tauri)
- WebView2 Runtime (в Windows 11 уже есть)
- Python 3 — только для portable-упаковки

## Установка (portable)

Единственный публикуемый артефакт — `Aniplayer-portable.zip` из релиза [`latest`](../../releases/tag/latest):

1. Распакуйте архив в папку, доступную на запись (не `Program Files`).
2. Запустите `aniplayer.exe`. Больше в архиве ничего нет: база создаётся в `data/aniplayer.db`, загрузки — в `downloads/`.
3. Для обновления замените файлы программы, сохранив `data/` и `downloads/`.

Установщиков нет; база, загрузки и настройки остаются внутри папки. Служебный кэш
WebView2 Tauri по умолчанию держит в `%LOCALAPPDATA%`. Подробности — в
[ADR 0006](docs/adr/0006-portable-only-distribution.md).

## Запуск

```bash
bun install
bun run tauri dev
```

Фронтенд отдельно (без окна Tauri): `bun run dev` — http://127.0.0.1:1420; там каталог работает, а загрузки и плеер — нет.

В Git Bash / MSYS-шеллах Rust не линкуется: `usr/bin/link.exe` из Git перекрывает
линкер MSVC, а `INCLUDE`/`LIB` не экспортируются. Для этих шеллов есть `bun run
tauri:win` — он подгружает окружение Visual Studio через `vsdevcmd.bat`
(`scripts/tauri-win.cmd`) и передаёт аргументы в `tauri`:

```bash
bun run tauri:win dev
```

## Сборка

```bash
bunx tauri build --no-bundle           # aniplayer.exe в src-tauri/target/release
python scripts/package_portable.py    # portable-папка: aniplayer.exe + пустая data/
```

Релизный workflow собирает эту папку, упаковывает в `Aniplayer-portable.zip` и проверяет, что
в архиве есть `aniplayer.exe` и что в нём **нет** медиа-рантайма и шейдеров. Бандлы MSI/NSIS
не публикуются; per-user-установщик и релизы по тегам версий — [#63](https://github.com/shidot3m/aniplayer/issues/63).

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную и выполняет только быстрые проверки: guard JS-тулчейна (CI и скрипты не должны содержать обращений к прежнему npm-клиенту), типы, Biome, Vitest, aislop, сборку фронтенда, а также `cargo fmt --check`, clippy с запретом предупреждений, аудит зависимостей и герметичные Rust-тесты (`test_db`, `test_download_queue`, `test_hls_playlist`, `test_playback_source`, `test_security_config`, `test_startup`). Любая сломанная проверка роняет CI. Релизные сборки здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию (03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`. Каждый запуск собирает Windows portable-сборку и публикует единственный артефакт:

- `Aniplayer-portable.zip` — `aniplayer.exe` и пустая папка `data/` (база создаётся при первом запуске).

Ночные и ручные сборки обновляют rolling-релиз [`latest`](../../releases/tag/latest) и перемещают тег `latest` на собранный коммит. Теги `v*` публикуют отдельный версионированный релиз и не меняют `latest`. Отдельного `Aniplayer.exe` в релизах нет.

## Тесты и качество кода

```bash
bun run typecheck   # типы: src, tests и конфиги сборки
bun run lint        # Biome (линт + форматирование)
bun run test        # Vitest
bun run build       # tsc + vite build
bun run check       # typecheck + Biome + Vitest + aislop
```

Плеер прогоняется через React Testing Library с hls.js как границей модуля (`tests/setup.ts`
подменяет библиотеку один раз для всех тестов): загрузка источника, смена Quality, события
ошибки и восстановления — всё на живом дереве оверлея.

Rust-проверки (из каталога `src-tauri`, с окружением MSVC):

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo audit
cargo test --locked --test test_db --test test_download_queue --test test_hls_playlist \
  --test test_playback_source --test test_security_config --test test_startup
```

`test_api` обращается к живому API AniLiberty и поэтому в CI не входит.

## Структура

```
src/app/             Оболочка приложения: композиция фичер (App, Header)
src/features/        Фичеры: catalog, release, continue-watching, player, downloads, bookmarks, settings
  player/renderer/   HLS-сессия: `<video>` + hls.js, вердикт об источнике, поверхность оверлея
src/shared/          Общие ui-компоненты, утилиты и доменные типы (ui/lib/types)
src-tauri/           Rust-бэкенд: API-клиент, БД, HLS-загрузки, валидация источника, IPC-команды
tests/               фронтенд-тесты (Vitest); границы фичер проверяет test_feature_boundaries.test.ts
scripts/             portable-упаковка, запуск Tauri и cargo из MSYS-шеллов
docs/                архитектура, ADR, схема AniLiberty API, заметки по Anime4K, инструкции для агентов
GLOSSARY.md          доменный словарь
AGENTS.md            правила работы агентов
data/, downloads/    локальные БД и загрузки (не в git)
```

Границы фичер и потоки данных описаны в [docs/architecture.md](docs/architecture.md),
термины — в [GLOSSARY.md](GLOSSARY.md), правила работы агентов — в [AGENTS.md](AGENTS.md).
