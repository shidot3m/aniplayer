# Живой прогон #65 — кадр без данных не попадает в `copyExternalImageToTexture`

Портативная сборка этой машины (Windows 10.0.19045 x64): `bun run tauri:win build --no-bundle` →
`src-tauri/target/release/aniplayer.exe`, sha256 `1470d2c61c44db426b6cca16269d3ae8c631405ae4de2d7e4c75321e1888110f`,
в собранном чанке `dist/assets/anime4kRenderer-*.js` лежит `readyState<HTMLMediaElement.HAVE_CURRENT_DATA`.
Управление — настоящие события ввода и запросы к живому webview через remote-debugging-port WebView2
(9224): `transitions.ps1` (на базе `../62/cdp_events.ps1`), скриншот — `../60/win32.ps1 -Action shot`.

## Правка

`Anime4kRenderer.renderFrame` начинается с проверки `video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA`:
пока у элемента нет текущего кадра, ни `copyExternalImageToTexture`, ни перестройка текстур не
выполняются. `forceRender` при пропуске не сбрасывается, поэтому первый же кадр, который появится,
красится штатно — и через `requestVideoFrameCallback`, и через кадровый цикл.

## Шов рендерера

`tests/test_anime4k_renderer_frame_gate.test.ts` гоняет настоящий `Anime4kRenderer` на поддельном
GPU-устройстве (пайплайн `anime4k-webgpu` замокан, кадровый цикл — ручной `requestAnimationFrame`):

- элемент без кадра (`readyState 0`) со старыми размерами `1280x720` → `copyExternalImageToTexture`
  не вызван, входная текстура не создана;
- `readyState` поднят до `HAVE_CURRENT_DATA` → копирование вызвано ровно один раз.

До правки первый случай падал: копирование вызывалось при `readyState 0`.

## Три перехода

`transitions.ps1 -LongRunMinutes 12` → `transitions.txt`, консоль — `console.txt`. Anime4K был
включён (канвас смонтирован, `opacity 0`), плеер — серия 3, `t 69,7`, кадр `1920x1080`.

```
13:36:56 baseline        ep=3 t=69,7  readyState=4 frame=1920x1080 canvas=True opacity=0
13:36:56 episode-switch  from=Эпизод 3 to=Эпизод 4          ← первый кадр новой серии
13:37:00 episode-start   ep=4 t=1,7   readyState=4 frame=1280x720  canvas=True opacity=0
13:37:25 quality-1920x1080 reached=True                     ← смена Quality 720p → 1080p
13:37:26 quality-1280x720  reached=True                     ← и обратно
13:37:30 autoplay from=Эпизод 4 reached=True                ← автопереход по концу серии
13:37:32 autoadvance     ep=5 t=2     readyState=4 frame=1280x720  canvas=True opacity=0
```

Все три перехода прошли на живом элементе; `fault` пуст во всех снимках, канвас не пропадал,
позиция продолжалась, серия сменилась сама. Честная деталь: первый снимок после переключения
серии — уже `t 1,7`, само окно без кадра попало между сэмплами (шаг 2 с), поэтому пропуск
копирования доказывает шов-тест, а живой прогон — отсутствие `OperationError` (AC). CDN в этом
прогоне отвечал: ретраи не участвовали.

## Долгий прогон

После автоперехода — 12 минут без вмешательства (13:37:51–13:49:52), 36 снимков с шагом 20 с;
медиа-время серии 5 с 20,3 до 741,4 с, стенное окно 12:01:

```
13:38:11 long-run ep=5 t=40,3   readyState=4 paused=False canvas=True opacity=0
13:43:51 long-run ep=5 t=380,9  readyState=4 paused=False canvas=True opacity=0
13:49:52 long-run ep=5 t=741,4  readyState=4 paused=False canvas=True opacity=0
```

Во всех 36 снимках `readyState 4`, `paused False`, `canvas True`, `opacity 0`, `fault` пуст.
`01-long-run-episode5.png` — окно приложения в это время: апскейлер включён, меню показывает 720p.

## Консоль

`console.txt` — весь поток, который отдал `Log.enable` вместе с собственными таймстампами событий.
В нём ровно одна строка, и она датирована моментом подписки (13:33:07, до старта прогона) —
`info intervention :: Images loaded lazily…`. В окне прогона (с 13:36:56) — ноль строк:
`console-summary.txt` = `GPU-copy rows inside the run window: 0`, `console-gpu.txt` пуст.
Ни одного `OperationError`, ни одного предупреждения `CopyExternalImageToTexture` за 3 перехода
и ~15 минут живого воспроизведения.

## Гейты

`bun run typecheck` · `bun run lint` · `bun run test` (23 файла, 101 тест) · `bunx aislop scan` =
**100/100** · `bun run build` — зелёные; Rust-код не менялся.
