import os
import shutil
import sys


def package_portable():
    print("=== Creating Aniplayer Portable Distribution Bundle ===")
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dist_dir = os.path.join(root_dir, "dist_portable")

    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    os.makedirs(dist_dir, exist_ok=True)

    data_dir = os.path.join(dist_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"[OK] Initialized portable data directory at {data_dir}")

    target_exe = os.path.join(
        root_dir, "src-tauri", "target", "release", "aniplayer.exe"
    )
    if os.path.isfile(target_exe):
        shutil.copy2(target_exe, os.path.join(dist_dir, "aniplayer.exe"))
        print("[OK] Copied compiled binary aniplayer.exe into bundle")
    else:
        print(
            f"[ERROR] Compiled binary not found at {target_exe}; "
            "run `bun run tauri:win build` first"
        )
        sys.exit(1)

    # The WebView is the playback backend, so the bundle carries the binary and
    # nothing else: no media runtime, no shader chain.
    print(
        "\n[SUCCESS] Portable bundle structure prepared successfully at dist_portable/"
    )


if __name__ == "__main__":
    package_portable()
