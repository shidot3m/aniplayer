"""Report what the library index and the downloads folder actually hold.

Reads the app's SQLite index and the files beside it so a startup purge can be
observed from outside the process. Evidence helper for issue #59 — not part of
the app.
"""

import sqlite3
import sys
from pathlib import Path

db_path = Path(sys.argv[1])
app_dir = Path(sys.argv[2])

conn = sqlite3.connect(db_path)
rows = list(
    conn.execute(
        "SELECT episode_id, release_id, file_path, download_status FROM downloaded_episodes ORDER BY episode_id"
    )
)
conn.close()

print(f"downloaded_episodes ({len(rows)}):")
for episode_id, release_id, file_path, status in rows:
    print(f"  {episode_id}  release={release_id}  status={status}  path={file_path}")

torrent_root = app_dir / "downloads" / "torrents"
legacy = torrent_root / "900" / "ep01.mkv"
print(
    f"legacy torrent media on disk: {legacy.is_file()} ({legacy.stat().st_size if legacy.is_file() else 0} bytes)"
)
for path in sorted(app_dir.joinpath("downloads").rglob("index.m3u8")):
    folder = path.parent
    segments = len(list(folder.glob("segment-*.ts")))
    size = sum(f.stat().st_size for f in folder.iterdir() if f.is_file())
    print(
        f"hls episode folder: {folder.relative_to(app_dir)}  segments={segments}  bytes={size}"
    )
