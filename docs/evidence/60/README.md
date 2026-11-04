# Живой прогон #60 — воспроизведение в WebView

Портативная сборка этой машины (Windows 10.0.19045 x64), `bunx tauri build --no-bundle` →
`python scripts/package_portable.py` → `dist_portable/aniplayer.exe`. Управление окном и
скриншоты — `win32.ps1` (Win32-примитивы, как в `docs/evidence/59`); запросы к живому webview —
`asset_probe.ps1` и `media_probe.ps1` через `--remote-debugging-port` WebView2.

## Одно окно, кадр внутри интерфейса

```
pid=12208 visible top-level windows: 2
visible window class="Tauri Window"           title="Aniplayer" size=1296x839 style=0x14CF0000 exStyle=0x00040110
visible window class="Tao Thread Event Target" title=""          size=16x16    style=0x94000000 exStyle=0x080800A0
```

Второе окно — служебное окно цикла событий tao (16×16, без заголовка), не поверхность видео.
`native-player` окна нет ни в одном состоянии плеера.

- `01-home.png` — каталог, непрозрачное окно с фоном приложения.
- `02-release.png` → `03-online-playback.png` — «Военная хроника Рометии» (10337), серия 1 играет в окне.
- `04-controls-t1.png` / `05-online-t2.png` — оверлей контролов; позиция 00:30 → 00:58.
- `06-settings-menu.png` / `07-quality-1080p.png` / `08-quality-720p.png` — Quality туда и обратно на
  живом воспроизведении, позиция продолжается (00:58 → 02:23), ошибки нет. В `08` на правом краю
  видна подсказка «Загрузка видеопотока...» на паузе — дефект, найденный прогоном: он исправлен
  в этом же тикете (подсказка теперь привязана к `readyState` элемента, тест — «promises a frame
  only while the media is starved…»).

## Скачанная серия играет с диска

Скачивание: `10-episode-menu.png` → «Скачать эпизод (HLS)»; виджет показал
`100% · 650 МБ · 142 / 142 сегментов · 8.9 МБ/с`, строка `downloaded_episodes` — `COMPLETED`,
`file_size = 681 225 245`, `file_path = E:\coding\aniplayer\dist_portable\downloads\10337\1\index.m3u8`.

**Первый прогон провалился** (`19-offline-fault-before-scope-fix.png`): оверлей показал
«Не удалось воспроизвести эпизод / Не удалось загрузить поток: сеть не отвечает». Зонд
`asset_probe.ps1` к тому же окну ответил на все четыре формы URL:

```
playlist, whole path in one segment: 403
playlist, one segment per directory: 403
segment beside the folder:           403
segment at the origin root:          403
```

403 на канонической форме `convertFileSrc` означали, что дело не в URL, а в scope:
`assetProtocol.scope = ["$EXE/downloads/**"]` не разворачивается — `PathResolver` tauri 2.12.5
не знает `$EXE` (он есть в описании конфига, но не в рантайме), а `Scope::new` молча пропускает
неразрешённый паттерн, оставляя пустой список разрешений. Исправление: `run_with_state` выдаёт
`app_dir/downloads` в scope на старте (`allow_directory(..., true)`) — из того же корня, против
которого canonicalizes `playback::resolve_source`. После пересборки тот же зонд:

```
playlist, whole path in one segment: 200 #EXTM3U|#EXT-X-VERSION:6|#EXT-X-TARGETDURATI
playlist, one segment per directory: 200 #EXTM3U|#EXT-X-VERSION:6|#EXT-X-TARGETDURATI
segment beside the folder:           200 <MPEG-TS, "FFmpeg" service provider>
segment at the origin root:          403
```

Форма «сегмент у корня origin» остаётся 403 — это ровно то разрешение URL, которое даёт
одно-сегментный `convertFileSrc`, и оно по-прежнему запрещено scope: поэтому `asset_url` и
кодирует по одному сегменту на каталог.

Повторный проигрывательный прогон (`20-library.png`, `22-offline-frame.png`) и `media_probe.ps1`
на живом элементе:

```
sample 1: {"currentSrc":"blob:http://tauri.localhost/7a96eb8a-…","readyState":4,"currentTime":12.3,"paused":false,"mediaOrigins":{"http://asset.localhost":6}}
sample 2: {"currentSrc":"blob:http://tauri.localhost/7a96eb8a-…","readyState":4,"currentTime":20.3,"paused":false,"mediaOrigins":{"http://asset.localhost":7}}
```

Элемент играет MediaSource-blob, позиция идёт в реальном времени (+8.0 с за 8 с), а все
медиа-запросы страницы — только `http://asset.localhost` (7 = плейлист + сегменты). У процесса
в этот момент одно удалённое соединение, `104.21.10.213:443` — это `aniliberty.top` (API-keepalive
из `loadInitialData`); у CDN `cache.libria.fun` (`104.26.2.138`, `104.26.3.138`, `172.67.69.152`)
соединений нет. Сеть физически не отключали: замер сделан наблюдением, по согласованию.

## Размер поставки

`archive_size.ps1` на этом же срезе:

```
[OK] Aniplayer-portable.zip = 5,7 MB (compressed), aniplayer.exe = 15,4 MB
entries:  aniplayer.exe (16 165 376 bytes)
[OK] no mpv/ and no shaders/ in the archive
```

`data/` в zip не попал (Compress-Archive не кладёт пустые каталоги; 7z в релизном workflow
кладёт). В mpv-эпохе архив нёс ~100 МБ распакованного `mpv/` плюс `shaders/anime4k/`.
