# Разработка

Для тех, кто собирает Aniplayer из исходников и правит код. Витрина проекта —
в [README.md](../README.md); как устроена поставка обоих каналов — в разделе «Что попадает
в архив» ниже; устройство кода — в [docs/architecture.md](architecture.md),
термины — в [GLOSSARY.md](../GLOSSARY.md), решения — в [docs/adr/](adr/).

## Стек

| Слой         | Технологии                                                                        |
| ------------ | --------------------------------------------------------------------------------- |
| UI           | React 19, TypeScript 7, Vite 8, Tailwind 4, Zustand, Radix UI, lucide-react       |
| Плеер        | `<video>` + hls.js 1.7 (MSE) внутри webview Tauri                                 |
| Апскейл      | Anime4K через WebGPU: `anime4k-webgpu` 1.0.0 (MIT), ленивый чанк поверх `<video>` |
| JS-тулчейн   | Bun 1.4.4 (установщик, рантайм и запуск скриптов; ADR 0011)                       |
| Оболочка     | Tauri 2.12 (Rust, edition 2021), asset-протокол на папку загрузок                 |
| Бэкенд       | Tauri IPC: `rusqlite` 0.41, `reqwest` 0.13, HLS-загрузчик, вердикт об источнике   |
| Тесты / линт | Vitest 5, Testing Library, Biome 2.6, aislop                                      |

Медиа-рантайм в архиве не нужен: декодирует WebView2, а он есть в Windows 10/11 (в Windows 11 —
из коробки).

## Требования к окружению

- Windows 10/11 x64
- [Bun](https://bun.sh/) 1.4.4 — единственный JS-тулчейн проекта; Node.js и npm не нужны
- [Rust](https://rustup.rs/) (stable, `x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) с C++ (для `rusqlite`/Tauri)
- WebView2 Runtime (в Windows 11 уже есть) — и WebGPU в нём, если включён апскейл Anime4K; без
  WebGPU апскейл недоступен, остальное работает как обычно
- Python 3 — только для упаковки и проверки релизного набора

## Запуск

```bash
bun install
bun run tauri dev
```

Фронтенд отдельно (без окна Tauri): `bun run dev` — http://127.0.0.1:1420; там каталог работает,
а загрузки и плеер — нет.

В Git Bash / MSYS-шеллах Rust не линкуется: `usr/bin/link.exe` из Git перекрывает линкер MSVC,
а `INCLUDE`/`LIB` не экспортируются. Для этих шеллов есть `bun run tauri:win` — он подгружает
окружение Visual Studio через `vsdevcmd.bat` (`scripts/tauri-win.cmd`) и передаёт аргументы
в `tauri`:

```bash
bun run tauri:win dev
```

## Сборка

```bash
bun run tauri:win build                 # aniplayer.exe + NSIS-установщик в src-tauri/target/release/bundle/nsis
python scripts/package_portable.py    # portable-папка: aniplayer.exe + пустая data/
```

Одна команда `tauri build` даёт оба канала: голый исполняемый файл для архива и установщик рядом
с ним. `scripts/verify_release.py` проверяет собранный набор — локально тем же вызовом, что и
конвейер перед публикацией (см. «CI и релизы»). `bunx tauri build --no-bundle` больше не путь релиза.

### Что попадает в архив

Внутри архива нет ни медиа-рантайма, ни папки шейдеров: hls.js, WebGPU-рендерер Anime4K и его
WGSL-таблицы (`anime4k-webgpu` 1.0.0, MIT, версия закреплена в lockfile) — frontend-код, вшитый
в `aniplayer.exe`; декодирует WebView2. Релизный конвейер роняет сборку, если `mpv/` или `shaders/`
всё же окажутся внутри zip.

Установщик для текущего пользователя: файлы в `%LOCALAPPDATA%\Aniplayer`, ярлык в Start Menu,
запись в «Установка и удаление программ», без повышения прав. Ассоциаций файлов установщик не
регистрирует (единственная прежняя — `magnet:` — ушла вместе с торрентами), минимальной версии
WebView2 не требует: старый рантайм стоит только недоступного апскейла Anime4K, а не установки.
Удаление снимает приложение, но `data/` и `downloads/` остаются на диске — в комплект установщика
они не входят. Служебный кэш WebView2 система по умолчанию держит в `%LOCALAPPDATA%`.

Оба канала держат `data/` и `downloads/` рядом со своим `aniplayer.exe`, поэтому перенос
установленной копии на другую машину остаётся копированием одной папки, а код приложения про
каналы не знает ничего. Подробности — в [ADR 0016](adr/0016-portable-archive-and-per-user-nsis-installer.md)
и [ADR 0006](adr/0006-portable-only-distribution.md).

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную
и выполняет только быстрые проверки: guard JS-тулчейна (CI и скрипты не должны содержать обращений
к прежнему npm-клиенту), типы, Biome, Vitest, aislop, сборку фронтенда, а также `cargo fmt --check`,
clippy с запретом предупреждений, аудит зависимостей и герметичные Rust-тесты (`test_db`,
`test_download_queue`, `test_hls_playlist`, `test_playback_source`, `test_security_config`,
`test_distribution_config`, `test_startup`). Любая сломанная проверка роняет CI. Релизные сборки
здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию
(03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`.
Каждый запуск собирает Windows-сборку и публикует один набор из трёх файлов:

- `Aniplayer-portable.zip` — `aniplayer.exe` и пустая папка `data/` (база создаётся при первом запуске).
- `Aniplayer-setup.exe` — per-user NSIS-установщик: ярлык в Start Menu и запись удаления, без повышения прав.
- `SHA256SUMS.txt` — SHA-256 обоих файлов.

Перед публикацией `scripts/verify_release.py` обязывает наличие всех трёх и проверяет содержимое
архива; после публикации те же файлы скачиваются с релиза и проверяются `sha256sum -c` — конвейер
отвечает за байты, которые получает пользователь, а не только за те, что остались в рабочей
директории. Несовпадение тега `v*` с версией из `tauri.conf.json` роняет запуск, а рассогласование
версий в манифестах роняет `src-tauri/tests/test_distribution_config.rs`.

Ночные и ручные сборки обновляют rolling-релиз [`latest`](https://github.com/shidot3m/aniplayer/releases/tag/latest)
всеми тремя файлами и перемещают тег `latest` на собранный коммит. Теги `v*` публикуют отдельный
версионированный релиз с тем же набором, не помечают его как latest и не двигают тег — собранные
версии остаются скачиваемыми.

## Тесты и качество кода

Зависимости, которые умеет поднимать Dependabot (`.github/dependabot.yml`), — GitHub Actions и
крейты `src-tauri`; JS-пакеты поднимают вручную, потому что лок-файл Bun (`bun.lock`) конвейер
проверяет через `bun install --frozen-lockfile`.

```bash
bun run typecheck   # типы: src, tests и конфиги сборки
bun run lint        # Biome (линт + форматирование)
bun run test        # Vitest
bun run build       # tsc + vite build
bun run check       # typecheck + Biome + Vitest + aislop
```

Плеер прогоняется через React Testing Library с hls.js как границей модуля (`tests/setup.ts`
подменяет библиотеку один раз для всех тестов): загрузка источника, смена Quality, события ошибки
и восстановления и политика ретраев (`test_player_retry_policy.test.tsx` — загрузочная политика
библиотеки, шаги через мёртвый сегмент, расход бюджета и объяснённая ошибка) — всё на живом дереве
оверлея.

Rust-проверки (из каталога `src-tauri`, с окружением MSVC):

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo audit
cargo test --locked --test test_db --test test_download_queue --test test_hls_playlist \
  --test test_playback_source --test test_security_config --test test_distribution_config --test test_startup
```

`test_api` обращается к живому API AniLiberty и поэтому в CI не входит.

## Инструменты репозитория

- `scripts/package_portable.py` — собирает portable-папку из готового `aniplayer.exe`.
- `scripts/verify_release.py` — проверяет релизный набор из трёх файлов; тот же вызов в конвейере и локально.
- `scripts/catalog_probe.py` — переписывает плейлисты, которые отдаёт CDN, и отвечает, есть ли в каталоге
  текстовая дорожка: это замер, которым ADR 0017 проверяет, не пора ли пересмотреть отказ от субтитров.
- `scripts/cea608_probe.py` — читает сегменты внутри этих плейлистов и ищет CEA-608 SEI-сообщения —
  вторую из двух вещей, которые нужны hls.js, чтобы выдать `TextTrack`.
- `scripts/tauri-win.cmd`, `scripts/msvc-cmd.cmd` — запуск `tauri` и `cargo` из MSYS-шеллов с
  окружением Visual Studio.

## Структура

```
src/app/             Оболочка приложения: композиция фичер (App, Header)
src/features/        Фичеры: catalog, release, continue-watching, player, downloads, bookmarks, settings
  player/renderer/   Плеер: `<video>` + hls.js, политика ретраев, вердикт об источнике, WebGPU-рендерер Anime4K
src/shared/          Общие ui-компоненты, утилиты и доменные типы (ui/lib/types)
src-tauri/           Rust-бэкенд: API-клиент, БД, HLS-загрузки, валидация источника, IPC-команды
tests/               фронтенд-тесты (Vitest); границы фичер проверяет test_feature_boundaries.test.ts
scripts/             упаковка portable-канала, проверка релизного набора, замеры каталога, запуск Tauri и cargo из MSYS-шеллов
docs/                архитектура, ADR, схема AniLiberty API, заметки по Anime4K, инструкции для агентов
GLOSSARY.md          доменный словарь
AGENTS.md            правила работы агентов
data/, downloads/    локальные БД и загрузки (не в git)
```

Границы фичер и потоки данных описаны в [docs/architecture.md](architecture.md).
