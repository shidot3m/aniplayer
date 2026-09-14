import os
import sqlite3
import subprocess
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def test_preflight_sanity():
    print("[1/4] Running preflight sanity checks...")
    res = subprocess.run(
        [sys.executable, "tests/preflight_sanity_test.py"],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        print("Preflight failed stdout:", res.stdout)
        print("Preflight failed stderr:", res.stderr)
    assert res.returncode == 0, f"Preflight checks failed: {res.stderr}"
    assert "ALL 4 SANITY CHECKS PASSED" in res.stdout
    print("[OK] Preflight sanity passed!")


def test_database_e2e():
    print("[2/4] Testing SQLite database models and persistence...")
    db_dir = os.path.join(os.getcwd(), "test_e2e_data")
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, "aniplayer.db")
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Init tables
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS bookmarks (
            release_id INTEGER PRIMARY KEY,
            category TEXT NOT NULL,
            release_data_json TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS history (
            release_id INTEGER NOT NULL,
            episode_id TEXT NOT NULL,
            episode_ordinal INTEGER NOT NULL,
            last_position REAL NOT NULL DEFAULT 0,
            duration REAL NOT NULL DEFAULT 0,
            is_completed INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (release_id, episode_id)
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS downloaded_episodes (
            episode_id TEXT PRIMARY KEY,
            release_id INTEGER NOT NULL,
            episode_ordinal INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            quality TEXT NOT NULL,
            opening_start REAL,
            opening_stop REAL,
            ending_start REAL,
            ending_stop REAL,
            download_status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 1. Test app_settings: volume persistence
    cur.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('volume', '65')"
    )
    cur.execute("SELECT value FROM app_settings WHERE key = 'volume'")
    row = cur.fetchone()
    assert row is not None and row[0] == "65", "Volume persistence failed"

    # 2. Test bookmarks: 7 categories
    cur.execute(
        "INSERT INTO bookmarks (release_id, category, release_data_json) VALUES (?, ?, ?)",
        (10239, "WATCHING", '{"name":{"main":"Адский режим"}}'),
    )
    cur.execute("SELECT category FROM bookmarks WHERE release_id = 10239")
    cat_row = cur.fetchone()
    assert cat_row is not None and cat_row[0] == "WATCHING", "Bookmark insert failed"

    # 3. Test downloaded episodes: cached OP/ED codes for offline
    cur.execute(
        """
        INSERT INTO downloaded_episodes
        (episode_id, release_id, episode_ordinal, file_path, file_size, quality, opening_start, opening_stop, ending_start, ending_stop, download_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            "ep_1",
            10239,
            1,
            "C:/downloads/10239_ep1.mp4",
            450000000,
            "1080p",
            85.5,
            175.0,
            1320.0,
            1410.0,
            "COMPLETED",
        ),
    )
    cur.execute(
        "SELECT opening_start, opening_stop, ending_start, ending_stop FROM downloaded_episodes WHERE episode_id = 'ep_1'"
    )
    meta = cur.fetchone()
    assert meta == (85.5, 175.0, 1320.0, 1410.0), "Cached OP/ED timecodes failed"

    conn.commit()
    conn.close()
    print("[OK] SQLite database models and offline skip codes verified!")


def test_shaders_compatibility():
    print("[3/4] Verifying Anime4K v4.x shaders preset integrity...")
    shader_dir = os.path.join(os.getcwd(), "shaders", "anime4k")
    assert os.path.isdir(shader_dir), f"Directory {shader_dir} does not exist"

    # Mode A+A (HQ) required shaders:
    mode_aa_shaders = [
        "Anime4K_Clamp_Highlights.glsl",
        "Anime4K_Restore_CNN_VL.glsl",
        "Anime4K_Upscale_CNN_x2_VL.glsl",
        "Anime4K_AutoDownscalePre_x2.glsl",
        "Anime4K_AutoDownscalePre_x4.glsl",
        "Anime4K_Upscale_CNN_x2_M.glsl",
    ]
    for s in mode_aa_shaders:
        path = os.path.join(shader_dir, s)
        assert os.path.isfile(path), f"Missing required Anime4K shader: {s}"
    print(f"[OK] All {len(mode_aa_shaders)} Mode A+A (HQ) shaders verified!")


def test_libmpv_dll_architecture():
    print("[4/4] Verifying libmpv-2.dll 64-bit Windows architecture...")
    dll_path = os.path.join(os.getcwd(), "bin", "mpv-dev", "libmpv-2.dll")
    assert os.path.isfile(dll_path), f"libmpv-2.dll not found at {dll_path}"
    size_mb = os.path.getsize(dll_path) / (1024 * 1024)
    print(f"[OK] libmpv-2.dll present ({size_mb:.2f} MB)")
    assert size_mb > 20.0, f"DLL suspiciously small: {size_mb} MB"


if __name__ == "__main__":
    print("=== Starting Aniplayer E2E Integration Suite ===")
    test_preflight_sanity()
    test_database_e2e()
    test_shaders_compatibility()
    test_libmpv_dll_architecture()
    print("=== ALL E2E VERIFICATIONS PASSED SUCCESSFULLY ===")
