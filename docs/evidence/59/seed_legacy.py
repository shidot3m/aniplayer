"""Seed the legacy state that #59's startup purge must clean up.

Writes a Downloaded episode row under the `torrent-` id prefix the retired
scanner used, together with its media file on disk, so a relaunch can be
observed dropping the row and leaving the file alone. Evidence helper for
issue #59 — not part of the app.
"""

import sqlite3
import sys
from pathlib import Path

db_path = Path(sys.argv[1])
app_dir = Path(sys.argv[2])

media = app_dir / "downloads" / "torrents" / "900" / "ep01.mkv"
media.parent.mkdir(parents=True, exist_ok=True)
media.write_bytes(b"legacy torrent payload - not the app's to delete")

conn = sqlite3.connect(db_path)
conn.execute(
    """
    INSERT OR REPLACE INTO downloaded_episodes
      (episode_id, release_id, episode_ordinal, file_path, file_size, quality, download_status)
    VALUES ('torrent-900-1', 900, 1.0, ?, 47, 'HEVC', 'COMPLETED')
    """,
    (str(media),),
)
conn.commit()
rows = [
    r[0]
    for r in conn.execute(
        "SELECT episode_id FROM downloaded_episodes ORDER BY episode_id"
    )
]
conn.close()

print(f"seeded: media file {media} ({media.stat().st_size} bytes)")
print(f"downloaded_episodes now: {rows}")
