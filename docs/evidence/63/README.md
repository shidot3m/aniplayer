# Живой прогон #63 — два канала поставки из одной сборки

Машина: Windows 10.0.19045 x64, неадминистрируемая сессия
(`IsInRole(Administrator) = False`) — то есть всё, что установлено ниже, установлено без повышения прав.
Сборка: `bun run tauri:win build` (exit 0), версия `1.0.0` из `tauri.conf.json`.

## 1. Одна сборка даёт оба артефакта

```
src-tauri/target/release/aniplayer.exe                          17 098 752 bytes
  sha256 bfcb59a48e76c8bc92dae80dc68b550355906b810741f6d7e63f36494c372568
src-tauri/target/release/bundle/nsis/Aniplayer_1.0.0_x64-setup.exe 5 521 285 bytes (5.27 MiB)
  sha256 e0431102aa9ae296de123d0b8bb96209126afa73de9c1a41885f4a307869dd8d
```

`bunx tauri build` больше не запускается с `--no-bundle`: бандлер NSIS — это и есть второй канал,
и `targets` в конфиге сведён к `["nsis"]`, чтобы WiX-MSI не собирался вовсе.

## 2. Размер архива без медиа-рантайма

```
Aniplayer-portable.zip = 6 885 500 bytes (6.57 MiB), entries: aniplayer.exe + data/
```

Замер локально (`python scripts/package_portable.py` → упаковка дерева). Тот же архив, собранный
конвейером на раннере через `7z`, весит **6 763 808 bytes** и содержит ровно те же две записи —
проверено скачиванием актуального артефакта релиза `latest` и разбором его центрального каталога:

```
[('aniplayer.exe', False), ('data/', True)]
```

Это же снимает вопрос, который оставляла упаковка #60: `7z` кладёт пустую `data/` в архив, поэтому
проверка релиза вправе её требовать. Для сравнения: один только mpv-рантайм в mpv-эпохе занимал
~100 MB в развёрнутом виде ([ADR 0010](../../adr/0010-mpv-subprocess-as-the-only-playback-backend.md)),
после [ADR 0014](../../adr/0014-webview-is-the-only-playback-backend.md) архив — 5.7 MB (#60), сейчас
6.9 MB: прирост — hls.js и WebGPU-чанк Anime4K, оба живут внутри исполняемого файла.

## 3. Контрольные суммы

`SHA256SUMS.txt` (175 bytes, ASCII, LF) в том виде, в котором его пишет конвейер:

```
5bb4764864846dbfdbbb33d131c6457c83b4ef855e18cff85e2ae446de0e8be0  Aniplayer-portable.zip
e0431102aa9ae296de123d0b8bb96209126afa73de9c1a41885f4a307869dd8d  Aniplayer-setup.exe
```

Формат проверен потребителем, а не только генератором — `sha256sum -c SHA256SUMS.txt` из Git Bash:

```
Aniplayer-portable.zip: OK
Aniplayer-setup.exe: OK
```

## 4. Проверка релизного набора не пуста

Позитивный прогон:

```
[OK] Aniplayer-portable.zip = 6,885,500 bytes
[OK] Aniplayer-setup.exe = 5,521,285 bytes
[OK] SHA256SUMS.txt = 175 bytes
[OK] archive = aniplayer.exe + empty data/, no runtime, no shaders, no user data
[OK] installer is a 5,521,285 byte NSIS package
[OK] Aniplayer-portable.zip matches its recorded digest
[OK] Aniplayer-setup.exe matches its recorded digest
[SUCCESS] Release set verified: Aniplayer-portable.zip, Aniplayer-setup.exe, SHA256SUMS.txt
```

Четыре негативных прогона на подделанных наборах (каждый откатан):

| Подделка                                      | Ответ `verify_release.py`                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| в `SHA256SUMS.txt` испорчен первый байт дампа | `[ERROR] Aniplayer-portable.zip does not match SHA256SUMS.txt: 5bb47648… != 00000000…`                                    |
| в архив добавлен `mpv/mpv.exe`                | `[ERROR] Aniplayer-portable.zip carries a media runtime or a shader chain: ['mpv/mpv.exe']` (и следом несовпадение дампа) |
| в sums добавлен третий файл `Aniplayer.exe`   | `[ERROR] SHA256SUMS.txt must cover exactly Aniplayer-portable.zip and Aniplayer-setup.exe, got […]`                       |
| в архив добавлен `downloads/42/1/index.m3u8`  | `[ERROR] Aniplayer-portable.zip carries someone's downloads: ['downloads/42/1/index.m3u8']`                               |

## 5. Portable-канал

Распаковано в `%TEMP%\aniplayer63\portable`, запущено `aniplayer.exe` (pid 3164):

```
extracted:  data <dir>   aniplayer.exe (17098752 bytes)
alive=True  mainwindow=Aniplayer
data tree:  aniplayer.db 32768 bytes
db beside exe: True
```

`01-portable-run.png` — каталог AniLiberty загружен живым API, окно одно.

Поиск всех `aniplayer.db` в профиле: единственные файлы, изменённые сегодня, лежат в
`%TEMP%\aniplayer63\{portable,moved}\data\`. В `%APPDATA%` и `%LOCALAPPDATA%` приложениях
`com.aniplayer.app` (641.4 MB) и `com.aniplayer.portable` (0 MB) нет ни одной базы — это кэш
WebView2 (`EBWebView`), как и утверждает [ADR 0006](../../adr/0006-portable-only-distribution.md).

## 6. Перенос копированием папки

В базу portable-копии до запуска вписана строка `app_settings('evidence_63_channel','portable')`,
папка скопирована целиком в `%TEMP%\aniplayer63\moved` и запущена оттуда (pid 9596):

```
copied db: 32768 bytes
launched from moved folder, alive=True
portable -> [('evidence_63_channel', 'portable')]
moved    -> [('evidence_63_channel', 'portable')]
```

Приложение, запущенное из скопированной папки, читает ту же базу рядом со своим исполняемым
файлом: новой базы не создано, помеченная строка на месте.

## 7. Установленный канал

`Aniplayer-setup.exe /S` из неадминистрируемой сессии, exit code 0.

```
install dir:  C:\Users\User\AppData\Local\Aniplayer
  aniplayer.exe 17098752
  uninstall.exe 79186
start menu:   C:\Users\User\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Aniplayer.lnk
              target = …\Aniplayer\aniplayer.exe, working dir = …\Aniplayer
HKCU\...\Uninstall\Aniplayer: DisplayName=Aniplayer  DisplayVersion=1.0.0  Publisher=aniplayer
              InstallLocation="C:\Users\User\AppData\Local\Aniplayer"
Program Files\Aniplayer: False        (per-machine вариант не предлагался)
```

Запуск установленного исполняемого файла (pid 7248) — `02-installed-run.png`: тот же каталог,
то же окно, и рядом с ним создана база:

```
now: data <dir>   data\aniplayer.db 32768
```

Кнопка «Открыть папку загрузок» на странице «Скачанные» (`downloader_open_folder` без release id)
создаёт папку загрузок там же:

```
  data <dir>
  downloads <dir>
  aniplayer.exe 17098752
  uninstall.exe 79186
  data\aniplayer.db 32768
```

Исполняемые файлы двух каналов различаются тремя байтами на смещении `0xC7D872` — это метка
бандлера Tauri, `BUNDLE_TYPE_VAR_UNK` против `BUNDLE_TYPE_VAR_NSS`; сборка одна и та же.

## 8. Удаление

`uninstall.exe /S`, exit code 0:

```
dir still exists: True
  data <dir>
  downloads <dir>
  data\aniplayer.db 32768
exe present: False
db present:  True
start menu shortcut: False
uninstall entry:     False
```

Удаление снимает программу, ярлык и запись реестра и не трогает `data/` с `downloads/` — они не
входят в комплект установщика, как и записано в
[ADR 0016](../../adr/0016-portable-archive-and-per-user-nsis-installer.md).

## 9. Мутации guard-теста

`src-tauri/tests/test_distribution_config.rs` зелёный на настоящем конфиге, поэтому каждая
проверка отдельно подделана и откатана (после всех четырёх — снова `4 passed`):

| Подделка в конфиге                        | Ответ теста                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `installMode: "perMachine"`               | `the installer may not offer a per-machine install: \`installMode\` must be \`currentUser\``                                         |
| `fileAssociations: [{ ext: ["ani"] … }]`  | `the app owns no document type, so the installer must register no association: [FileAssociation { ext: [AssociationExt("ani")] … }]` |
| `minimumWebview2Version: "109.0.1518.78"` | `installation must not depend on a WebView2 version; an older runtime degrades Anime4K, not the app`                                 |
| `package.json` → `1.0.1`                  | `\`package.json\` and \`tauri.conf.json\` must carry the same version`                                                               |

## Что осталось непроверенным

- Подпись кода: установщик не подписан, поэтому первая загрузка встретит предупреждение
  SmartScreen. Сертификата у проекта нет — это принятые последствия ADR 0016, вынесенные в
  отдельный тикет [#66](https://github.com/shidot3m/aniplayer/issues/66).
- Публикация тега `v1.0.0` в реальном релизе: конвейер проверен по этапам (сборка, упаковка,
  дампы, верификация набора, чтение опубликованных байтов обратно), сам тег ставится при
  приземлении ветки, и его результат дописывается сюда.
