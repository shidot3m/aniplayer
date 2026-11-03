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
            f"[ERROR] Compiled binary not found at {target_exe}; run `bunx tauri build --no-bundle` first"
        )
        sys.exit(1)

    # The mpv runtime is the only playback backend, so a bundle without it
    # cannot play anything. `scripts/get_mpv.py` stages it beside the build.
    mpv_dir = os.path.join(root_dir, "src-tauri", "target", "release", "mpv")
    if os.path.isfile(os.path.join(mpv_dir, "mpv.exe")):
        shutil.copytree(mpv_dir, os.path.join(dist_dir, "mpv"))
        print(f"[OK] Copied mpv runtime from {mpv_dir} into bundle")
    else:
        print(
            f"[ERROR] mpv runtime not found at {mpv_dir}; run `python scripts/get_mpv.py src-tauri/target/release/mpv` first"
        )
        sys.exit(1)

    shaders_dir = os.path.join(root_dir, "shaders")
    if os.path.isdir(shaders_dir):
        shutil.copytree(shaders_dir, os.path.join(dist_dir, "shaders"))
        print("[OK] Copied Anime4K shaders into bundle")
    else:
        print(f"[ERROR] Anime4K shaders not found at {shaders_dir}")
        sys.exit(1)

    print(
        "\n[SUCCESS] Portable bundle structure prepared successfully at dist_portable/"
    )


if __name__ == "__main__":
    package_portable()
