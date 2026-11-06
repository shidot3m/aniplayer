# Вклад

Спасибо, что читаете это. Небольшие правила экономят время обоим.

## Прежде чем писать код

- Найдите существующую issue по теме; новой теме сначала просите описания, а не пул-реквеста —
  решение может противоречить уже принятому ADR (`docs/adr/`).
- Для ошибки шаблон issue соберёт нужное: версия программы, шаги, что ожидали, что получили,
  лог из `data/` если он есть.

## Окружение

- Windows 10/11 x64
- [Bun](https://bun.sh/) — единственный JS-тулчейн проекта, Node.js и npm не нужны
- [Rust](https://rustup.rs/) stable `x86_64-pc-windows-msvc` + Visual Studio Build Tools с C++

```bash
bun install
bun run tauri:win dev     # окно приложения; из Git Bash / MSYS-шеллов — именно tauri:win, не tauri
```

## Проверки

Всё, что требует CI, запускается двумя командами:

```bash
bun run check            # typecheck + Biome + Vitest + aislop
bun run build            # tsc + vite build — его же проверяет CI
```

Rust-часть (из `src-tauri`, с окружением MSVC):

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked --test test_db --test test_download_queue --test test_hls_playlist \
  --test test_playback_source --test test_security_config --test test_distribution_config \
  --test test_startup
```

`test_api` обращается к живому API AniLiberty, поэтому в CI он не входит и в этот список не
включён.

PR должен проходить их полностью — сломанная проверка не «откладывается на потом».

## Как устроен код

- `src/app/` только компонует фичеры; `src/features/<фича>/` импортирует своё, общий слой
  `src/shared/` и чужие фичеры — исключительно через их barrels. Границы держит тест
  `tests/test_feature_boundaries.test.ts`.
- Rust-бэкенд живёт в `src-tauri/`: API-клиент, база, HLS-загрузки, вердикт об источнике,
  IPC-команды.
- Плеер — `<video>` + hls.js внутри webview; никакого второго окна и никакого внешнего процесса
  проигрывателя ([ADR 0014](docs/adr/0014-webview-is-the-only-playback-backend.md)).
- Термины интерфейса и домена — по [GLOSSARY.md](GLOSSARY.md); устройство — по
  [docs/architecture.md](docs/architecture.md).

## Стиль

- TypeScript `strict`, Biome (формат и линт) — `bunx biome check --write .` чинит то, что чинится
  сам; `bun run lint` только проверяет.
- Кавычки двойные, отступы два пробела, `lineWidth` 100 — всё уже в `biome.jsonc`.
- Комментарии пишутся там, где непонятно «почему», а не «что делает строка».
- Коммиты в формате Conventional Commits с областью: `fix(ui): …`, `feat(downloads): …`,
  `docs(readme): …`.
- Изменение поведения, структуры или зависимостей правит документацию в том же коммите:
  README, GLOSSARY, `docs/architecture.md`, затронутые ADR.

## Пул-реквест

- Один PR — одна причина. Отдельно багфикс, отдельно косметика.
- В описании: что и почему, какие проверки прогнаны, какие критерии приняты, а какие остались
  (например, требуют железа, которого у вас нет).
- Скриншот или запись экрана — обязательны для любого изменения интерфейса.
- Мержится через squash; ветка после мержа удаляется.

## Лицензия

Присылая патч, вы подтверждаете, что распространяете его под GNU GPL v3 — той же лицензией,
под которой живёт проект ([LICENSE](LICENSE)).
