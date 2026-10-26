# Aniplayer

Десктопный аниме-плеер для Windows: Tauri 2 + React 19 + нативный `libmpv` с апскейлом Anime4K, каталог AniLiberty, торрент-стриминг и скачивание серий.

## Возможности

- Воспроизведение через `libmpv` (аппаратное декодирование, точный seek, управление паузой/громкостью)
- Anime4K-шейдеры (GLSL) с пресетами и сохранением выбора
- Каталог, расписание, жанры, франшизы — API AniLiberty
- Торрент-стриминг серий без полной загрузки (`librqbit`)
- Скачивание серий, очередь загрузок, виджет прогресса
- Закладки, «Продолжить просмотр», история — SQLite (`data/aniplayer.db` рядом с exe)

## Стек

| Слой | Технологии |
| --- | --- |
| UI | React 19, TypeScript, Vite 6, Tailwind 3, Zustand, Radix UI, lucide-react |
| Оболочка | Tauri 2 (Rust 2021) |
| Бэкенд | `libmpv` через `libloading`, `librqbit`, `rusqlite`, `reqwest` |
| Тесты / линт | Vitest, Testing Library, Biome |

## Требования

- Windows 10/11 x64
- [Node.js](https://nodejs.org/) 20+ и npm
- [Rust](https://rustup.rs/) (stable, `x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) с C++ (для `rusqlite`/Tauri)
- WebView2 Runtime (в Windows 11 уже есть)

## Подготовка `bin/`

Каталог `bin/` **не хранится в репозитории** (там 115 МБ бинарников). Без него приложение запустится, но плеер не заработает: `libmpv-2.dll` подгружается в рантайме, а не линкуется при сборке.

Создайте структуру:

```
bin/
├─ 7za.exe                      (опционально)
└─ mpv-dev/
   ├─ libmpv-2.dll              ← обязательно
   ├─ libmpv.dll.a              (опционально)
   └─ include/
      └─ mpv/
         ├─ client.h
         ├─ render.h
         ├─ render_gl.h
         └─ stream_cb.h
```

| Файл | Зачем | Откуда |
| --- | --- | --- |
| `bin/mpv-dev/libmpv-2.dll` | Рантайм-библиотека плеера. Ищется в `bin/mpv-dev/`, рядом с exe, в `dist_portable/` | [mpv-dev сборки](https://sourceforge.net/projects/mpv-player-windows/files/libmpv/) (`mpv-dev-x86_64-*.7z`) или [shinchiro/mpv-winbuild-cmake](https://github.com/shinchiro/mpv-winbuild-cmake/releases) (тег `mpv-dev`) |
| `bin/mpv-dev/libmpv.dll.a` | Импорт-библиотека, нужна только для нативной линковки | тот же архив |
| `bin/mpv-dev/include/mpv/*.h` | Заголовки C API (справка/FFI) | тот же архив |
| `bin/7za.exe` | Утилита распаковки, кодом сейчас не используется | [7-zip.org](https://www.7-zip.org/download.html) (7z Extra) |

Быстрая раскладка из скачанного архива (PowerShell):

```powershell
New-Item -ItemType Directory -Force bin/mpv-dev | Out-Null
# распакуйте mpv-dev-*.7z, затем укажите путь к папке с содержимым:
Copy-Item -Recurse .\mpv-dev\* bin\mpv-dev\ -Force
Copy-Item .\7za.exe bin\ -Force
```

Проверка после сборки: файл `libmpv-2.dll` должен оказаться рядом с `aniplayer.exe` (для portable-сборки это делает скрипт ниже).

## Запуск

```bash
npm install
npm run tauri dev
```

Фронтенд отдельно (без окна Tauri): `npm run dev` — http://127.0.0.1:1420.

## Сборка

```bash
npm run tauri build          # бандл (msi/nsis) в src-tauri/target/release/bundle
python scripts/package_portable.py   # portable-сборка в dist_portable (копирует libmpv-2.dll и шейдеры)
```

## CI и релизы

`.github/workflows/ci.yml` запускается на каждый push в `master`, каждый pull request и вручную и выполняет только быстрые проверки: сборку фронтенда, Biome, Vitest, aislop и герметичные Rust-тесты (`test_db`, `test_scanner`). Релизные сборки здесь не запускаются.

`.github/workflows/release.yml` — отдельный релизный конвейер. Он запускается по ночному расписанию (03:00 UTC), вручную на ветке `master` (Actions → Release → Run workflow) и по тегам версий `v*`. Каждый запуск собирает Windows portable-сборку и публикует единственный артефакт:

- `Aniplayer-portable.zip` — `aniplayer.exe`, `libmpv-2.dll` (последний [mpv-dev](https://github.com/shinchiro/mpv-winbuild-cmake/releases)) и шейдеры Anime4K.

Ночные и ручные сборки обновляют rolling-релиз [`latest`](../../releases/tag/latest) и перемещают тег `latest` на собранный коммит. Теги `v*` публикуют отдельный версионированный релиз и не меняют `latest`. Отдельного `Aniplayer.exe` в релизах нет.

## Тесты и качество кода

```bash
npx vitest run     # юнит-тесты
npx @biomejs/biome check .  # линт + форматирование
npx tsc --noEmit   # типы
```

## Структура

```
src/                 React-приложение (components, hooks, store, lib, types)
src-tauri/           Rust-бэкенд: плеер (mpv.rs), торренты, БД, IPC-команды
shaders/anime4k/     GLSL-шейдеры Anime4K (в репозитории)
bin/                 локальные бинарники libmpv / 7-Zip (см. выше, не в git)
scripts/             portable-упаковка
docs/                выгрузка схемы AniLiberty API
tests/               тесты фронтенда
data/, downloads/    локальные БД и загрузки (не в git)
```
