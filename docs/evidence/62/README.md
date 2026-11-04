# Живой прогон #62 — bounded-ретраи hls.js против ротации CDN-хостов

Портативная сборка этой машины (Windows 10.0.19045 x64): `bun run tauri:win build --no-bundle` →
`src-tauri/target/release/aniplayer.exe` → `dist_portable/aniplayer.exe`, sha256 `1ac4cb14f1ebb94d…`
у обоих файлов — под прогонами ниже ровно тот бинарник, который кладётся в архив. Управление —
настоящие события ввода и запросы к живому webview через remote-debugging-port WebView2 (9224):
`cdp_events.ps1` (клиент, который в отличие от `61/cdp.ps1` ещё и копит CDP-события),
`click.ps1`, `state.ps1`, `probe.ps1`, `netlog.ps1`, `playlist_probe.ps1`, `host_map_probe.ps1`,
`block_host.ps1`, `quality_under_retries.ps1`, `long_run.ps1`; скриншоты — `../60/win32.ps1 -Action shot`.

Порядок такой не для порядка: политика в `src/features/player/renderer/retryPolicy.ts` вся выведена
из замеров ниже, и первые прогоны показали, что наугад выбранная политика не работает.

## Что измеряется до решения

`playlist_probe.ps1` на живом плейлисте серии («Борьба в прямом эфире», 720p):

```
{"playlist":"1/720/9a834235125896cf518ddfa8850fc336.m3u8","targetduration":12,"segments":138,
 "shortest":3.086622,"longest":11.761756,"median":10.01,"totalSeconds":1375}
```

138 сегментов по ~10 с, `#EXT-X-TARGETDURATION: 12`, один тир, ни `#EXT-X-KEY`, ни `#EXT-X-MAP` —
ровно та форма, под которую и подобраны числа политики.

`netlog.ps1` за 60 с воспроизведения (`netlog-02.txt`): каждый сегмент — это 302 с entry-хоста
`cache-rfn.libria.fun` на один из бэкендов, и за минуту их сменилось пять:

```
   11  cache-rfn.libria.fun          (запросы плейлиста и сегментов, с которых начинается 302)
    3  cache1.cache-ru3.libria.fun
    2  cache2.cache-ru1.libria.fun
    2  cache1.cache-ru2.libria.fun
    2  cache2.cache-ru3.libria.fun
    1  cache1.cache-ru1.libria.fun
```

`host_map_probe.ps1` отвечает на вопрос, на котором держится вся политика: можно ли попасть на
другой хост, повторив тот же сегмент. Восемь следующих сегментов запрошены по три раза каждый:

```
_00000.ts  cache1.cache-ru3   (×3 один и тот же)
_00001.ts  cache2.cache-ru3   (×3 один и тот же)
_00002.ts  cache2.cache-ru3   (×3 один и тот же)
_00003.ts  cache2.cache-ru1   (×3 один и тот же)
_00004.ts  cache2.cache-ru1   (×3 один и тот же)
_00005.ts  cache1.cache-ru2   (×3 один и тот же)
_00006.ts  cache2.cache-ru3   (×3 один и тот же)
_00007.ts  cache1.cache-ru1   (×3 один и тот же)
```

Бэкенд выбирается по пути сегмента и остаётся выбранным. Повтор мёртвого сегмента — это повтор
запроса к мёртвой машине; живую машину даёт следующий сегмент. Отсюда и «шаг» в политике, и то,
что шаг привязан к концу буфера, а не к позиции воспроизведения.

`probe.ps1` на живом элементе: `worker: "hls.worker-DX51GcGk.js"` — страница реально запросила
воркер трансмуксера. Без `workerPath` в ESM-сборке этого запроса нет: `enableWorker` по умолчанию
`true`, но воркер ESM-бандл сам найти не может, и трансмуксинг молча остаётся в главном потоке —
том самом, который держит контролы.

## Симптом #45, воспроизведённый на новом стеке

`block_host.ps1` кладёт Fetch-перехватом один хост (`errorReason = ConnectionRefused`) и смотрит,
что делает плеер, никого не трогая. Базой служит артефакт до этой работы (тот же `aniplayer.exe`,
что и в #61, где hls.js жил на дефолтах): 45 с мёртвого `cache-ru2` — кадр встаёт на 870.5 и держится
до конца блокировки:

```
    38s PLAY   currentTime=870,5 readyState=2 paused=False bufferEnd=871 blocked=9 failed=9
    46s PLAY   currentTime=870,5 readyState=2 paused=False bufferEnd=871 blocked=11 failed=10
+2s AFTER  currentTime=871,5 readyState=4 paused=False bufferEnd=912
```

`readyState 2` у края буфера, позиция не движется, кадр не меняется — ровно жалоба из #45, на
WebView-стеке. Дальнейшие прогоны по порядку показали, что именно в политике не так.

**Три попытки, каждая из которых что-то измерило.** `block-03…block-06` — лестница из повторов по
fatal-ошибке сети: плеер умирает с объяснением через 50–100 с, потому что fatal для одно-тировой
VOD-нарезки не наступает вовсе: `diag-01.txt` (тот же прогон с включённым логом hls.js) виден цикл
библиотеки, который не кончается —

```
     7s PAGE   [warn] > Fragment 80 of main 0 errored with fragLoadError, retrying loading 1/2 in 500ms
    11s PAGE   [warn] > fragLoadError reached or exceeded max retry (2)
    39s PAGE   [log] > startLoad(812.850583)
    39s PAGE   [log] > [stream-controller]: Loading main sn: 80 of main playlist 0 (frag:[800.85-810.06])
```

`startLoad` вызван, позиция передана — и всё равно грузится `sn: 80`: библиотека выводит позицию
загрузки из буфера и playhead, а не из аргумента. Отсюда два вывода, записанных в политику:
считать неудачу самой (`segmentFailureLimit`), не дожидаясь fatal, и двигаться самому —
`this.seek(target)` перед `hls.startLoad(target)`, иначе мёртвый сегмент не остаётся позади.

`block-07.txt` (шаг по плейхеду, 332 при буфере до 371) — за 120 с ноль успешных ответов, потому
что шаг на `332 + 12` попадает внутрь уже загруженного и загрузчик снова берёт мёртвый сегмент.
Якорь перенесён на конец буфера, и `block-08.txt` показывает цену шага не вовремя: playhead ушёл
бы на 40 с вперёд от того, что ещё можно смотреть. Отсюда последнее правило — шаг только когда
медиа кончилось.

## Блокировка хоста на финальном артефакте

`block_host.ps1 -Pattern "*cache1.cache-ru3*" -Seconds 150 -TryControls` → `block-final-01.txt`.
Один бэкенд мёртв 150 с; остальные отвечают.

```
     1s PLAY   currentTime=781,3  readyState=4 bufferEnd=811  blocked=0  answered=0
    90s PLAY   currentTime=867,3  readyState=4 bufferEnd=872  blocked=3  answered=6
    95s PLAY   currentTime=871,6  readyState=2 bufferEnd=872  blocked=3  answered=6   ← медиа кончилось
   100s PLAY   currentTime=887,5  readyState=4 bufferEnd=901  blocked=5  answered=8   ← шаг через дыру
   115s PLAY   currentTime=901,2  readyState=2 bufferEnd=901  blocked=6  answered=8
   125s PLAY   currentTime=925,2  readyState=1 bufferEnd=901  blocked=11 answered=11
   135s PLAY   currentTime=941,8  readyState=4 bufferEnd=972  blocked=12 answered=12
   150s PLAY   currentTime=957,1  readyState=4 bufferEnd=990  blocked=12 answered=14
```

Сегменты, которые уходили на мёртвый хост и были оставлены: `00087`, `00090`, `00091`, `00092`
(по три попытки каждый — столько, сколько им отпущено политикой), дальше загрузчик идёт `00093…00098`.
14 сегментов за это время отвечены другими бэкендами. Позиция: 781.3 → 957.1 за 150 с стенки; задержки
случились ровно там, где элемент доел буфер (95 с и 115 с), и каждая кончилась шагом вперёд, а не
застывшим кадром. `fault` во всех снимках пуст: ни «Не удалось загрузить поток», ни «Не удалось
воспроизвести эпизод» (`grep -c "Не удалось" block-final-01.txt` = 0), сессию не нужно было ни
перезапускать, ни переоткрывать. Контролы отвечали внутри окна блокировки, настоящим кликом по
`[data-testid="player-play-pause-btn"]`:

```
14s CLICK  pause click -> paused=True, second click -> paused=False
```

На более жёстком варианте (`diag-02.txt`, тот же код с логами, мёртв `*cache1.cache-ru*` — доля
мёртвых бэкендов больше половины) видно, как шаг работает по номерам сегментов: `sn: 80 → 81 → … → 91`,
27 запросов в мёртвый хост, 5 отвеченных, ноль объяснённых ошибок, позиция 816 → 1005.

## Quality под ретраями

`quality_under_retries.ps1` переключает 1080p → 720p настоящим меню настроек в тот момент, когда
CDN кладётся: 14 запросов в мёртвый хост за прогон. `quality-01.txt`:

```
     0s before {"t":1123.2,"frame":"1920x1080","readyState":4,"bufferEnd":1162,"fault":""}
    53s quality-switch {"t":1185.5,"frame":"1920x1080","readyState":4,"bufferEnd":1211,"fault":""}
    68s quality-switch {"t":1197.9,"frame":"0x0","readyState":0,"paused":true,"bufferEnd":0,"fault":""}
    83s quality-switch {"t":1222.6,"frame":"1280x720","readyState":1,"bufferEnd":1211,"fault":""}
   103s after {"t":1241.8,"frame":"1280x720","readyState":4,"bufferEnd":1282,"fault":""}
```

Кадр меняет тир, позиция продолжается (1197.9 → 1222.6), ошибки нет. Честная деталь: на перегрузке
источника элемент на ~15 с остаётся без кадра (`0x0`, `readyState 0`) — это цикл загрузки нового
тира под `switchUrl`, а не смерть сессии; оверлей в это время показывает «Загрузка видеопотока…».
`04-quality-720-under-retries.png` — 720p после переключения.

## Долгий прогон

`long_run.ps1 -Minutes 27 -EverySec 20` → `long-run-final.txt`, 72 снимка живого элемента, от 22:50:34
до 23:17:16, без единого ручного действия:

```
22:50:34 ep4 t=0.4    duration=1375 readyState=4 paused=false segments=6   distinct=6   replays=0
23:10:10 ep4 t=1267.1 duration=1375 readyState=4 paused=false segments=129 distinct=129 replays=0
23:10:36 ep5 t=7.7    duration=1375 readyState=4 paused=false segments=137 distinct=137 replays=0
23:17:16 ep5 t=495.4  duration=1375 readyState=4 paused=false segments=181 distinct=181 replays=0
23:20:48 ep5 t=682.4  duration=1375 readyState=4 paused=false segments=12  distinct=12  replays=0
```

Последний снимок — из второго подписчика (`long-run-final-tail.txt`, 23:18:52–23:20:48), он обнуляет
счётчики запросов при старте, поэтому `segments=12`: это окно в 2 минуты, а не продолжение 181. Серия 5
идёт дальше, `readyState` снова 4 во всех снимках, переконнектов ноль. Итого без ручного вмешательства
сыграна серия 4 целиком и ~13 минут серии 5.

- Серия 4 сыграна **целиком с нуля** (0.4 → конец), на 23:10:36 сама началась серия 5 (`autoplayNext`),
  и она же играла дальше до конца замера — 8 минут следующей серии сверху.
- **Все 72 снимка**: `readyState 4`, `paused false`. Ни одного зависания, ни одного «Загрузка видеопотока…».
- Скорость: отношение медиа-времени к стенному по всем 70 межснимковым интервалам — медиана **1.004**,
  минимум 0.90; два выброса 4.4 и 4.47 — это автопропуск опенинга и эндинга, а не ускорение.
- **Переконнектов ноль**: `replays` (число URL, запрошенных более одного раза) во всех снимках равен 0,
  `segments` = `distinct` на всём прогоне — 181 медиа-запрос, ни одного повтора. Плеер за 27 минут ни разу
  ничего не переспрашивал; политика сработала пораньше, на прогонах с блокировкой.
- `state-03.txt` и `05-long-run-episode4.png` — оверлей живой серии в окне приложения, диалога ошибки нет.

Консоль. `Log.enable` при подписке выкладывает всё, что браузер накопил, поэтому первые 40 строк
`console-final.txt` датированы моментом подписки и к прогону отношения не имеют. Прогон продолжен
версией скрипта, которая пишет **собственный** таймстамп события → `console-final-tail.txt`, и он
говорит правду: за чистое окно 23:18:52–23:20:48 (серия 5, `t` 591.7 → 682.4, `readyState` 4, ноль
переконнектов) в консоли — ни одной сетевой ошибки и ни одной ошибки приложения, а ровно одно
`OperationError: copyExternalImageToTexture … video element that doesn't have back resource` из
`anime4kRenderer.renderFrame`. Значит дефект рендерера не привязан к границе серии: он случается и при
обычном воспроизведении. Живёт отдельно — [#65](https://github.com/shidot3m/aniplayer/issues/65).

## Гейты

`bun run typecheck` · `bun run lint` · `bun run test` (99) · `bunx aislop ci` = **100/100** · `bun run build`;
`cargo test --locked` — зелёные (Rust-код не менялся). Тир on-demand после добавления воркера:
оверлей 30.63 kB + hls.js 579.11 kB + `hls.worker` 118.36 kB = **728 kB** против 1 MB
([ADR 0002](../../adr/0002-bundle-budget-and-code-splitting.md)), входной чанк 379 kB против 500 kB —
воркер в него не попадает, в entry лежит только строка его URL; `tests/test_bundle_split.test.ts` это и меряет.
