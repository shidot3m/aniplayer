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

    # 1. Copy libmpv-2.dll
    bin_dll = os.path.join(root_dir, "bin", "mpv-dev", "libmpv-2.dll")
    if os.path.isfile(bin_dll):
        dest_dll = os.path.join(dist_dir, "libmpv-2.dll")
        shutil.copy2(bin_dll, dest_dll)
        print(f"[OK] Copied libmpv-2.dll to {dest_dll}")
    else:
        print(f"[ERROR] Source libmpv-2.dll not found at {bin_dll}")
        sys.exit(1)

    # 2. Copy Anime4K shaders
    src_shaders = os.path.join(root_dir, "shaders", "anime4k")
    dest_shaders = os.path.join(dist_dir, "shaders", "anime4k")
    if os.path.isdir(src_shaders):
        shutil.copytree(src_shaders, dest_shaders)
        shader_count = len([f for f in os.listdir(dest_shaders) if f.endswith(".glsl")])
        if shader_count == 0:
            print(f"[ERROR] No Anime4K shaders found at {src_shaders}")
            sys.exit(1)
        print(f"[OK] Copied {shader_count} Anime4K shaders to {dest_shaders}")
    else:
        print(f"[ERROR] Shaders directory not found at {src_shaders}")
        sys.exit(1)

    # 3. Create data directory
    data_dir = os.path.join(dist_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    print(f"[OK] Initialized portable data directory at {data_dir}")

    # 4. Check if release binary exists
    target_exe = os.path.join(
        root_dir, "src-tauri", "target", "release", "aniplayer.exe"
    )
    if os.path.isfile(target_exe):
        shutil.copy2(target_exe, os.path.join(dist_dir, "aniplayer.exe"))
        print("[OK] Copied compiled binary aniplayer.exe into bundle")
    else:
        print(
            f"[ERROR] Compiled binary not found at {target_exe}; run `npx tauri build --no-bundle` first"
        )
        sys.exit(1)

    print(
        "\n[SUCCESS] Portable bundle structure prepared successfully at dist_portable/"
    )


if __name__ == "__main__":
    package_portable()
