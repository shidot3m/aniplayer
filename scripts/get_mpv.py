"""Fetch the pinned mpv runtime and stage it beside a build of the app.

The release workflow calls this before `package_portable.py`; developers run it
to make `npx tauri dev` and `npx tauri build` able to play. The download is
verified against the published SHA-256 digest and cached, so a run only pays
the transfer once.
"""

import hashlib
import os
import shutil
import sys
import urllib.request
import zipfile

MPV_VERSION = "v0.41.0"
MPV_ASSET = f"mpv-{MPV_VERSION}-x86_64-w64-mingw32.zip"
MPV_URL = (
    f"https://github.com/mpv-player/mpv/releases/download/{MPV_VERSION}/{MPV_ASSET}"
)
# Digest published by GitHub for the asset (releases API `digest` field).
MPV_SHA256 = "a49811c0752c108b8260636f9c6f6fcb97406641c98b30f1e7b500dfb20177de"


def runtime_dir():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(root, ".cache", "mpv-" + MPV_VERSION)


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_asset():
    dest = runtime_dir()
    exe = os.path.join(dest, "mpv.exe")
    if os.path.isfile(exe):
        print(f"[OK] Reusing cached mpv runtime at {dest}")
        return dest
    os.makedirs(dest, exist_ok=True)

    archive = os.path.join(dest, MPV_ASSET)
    print(f"[..] Downloading {MPV_URL}")
    with (
        urllib.request.urlopen(MPV_URL, timeout=120) as response,
        open(archive, "wb") as handle,
    ):
        shutil.copyfileobj(response, handle)

    checksum = sha256_of(archive)
    if checksum != MPV_SHA256:
        os.remove(archive)
        raise SystemExit(
            f"[ERROR] Checksum mismatch for {MPV_ASSET}: expected {MPV_SHA256}, got {checksum}"
        )
    print("[OK] SHA-256 verified")

    # The GitHub asset is an outer zip holding one inner build archive; the inner
    # archive is read straight from the outer one, never written to disk.
    with zipfile.ZipFile(archive) as outer:
        inner_names = outer.namelist()
        if len(inner_names) != 1:
            raise SystemExit(f"[ERROR] Unexpected archive layout: {inner_names}")
        with (
            outer.open(inner_names[0]) as inner_bytes,
            zipfile.ZipFile(inner_bytes) as inner,
        ):
            for name in inner.namelist():
                base = os.path.basename(name)
                if not base:
                    continue
                if base == "mpv.exe" or base.endswith(".dll"):
                    with (
                        inner.open(name) as source,
                        open(os.path.join(dest, base), "wb") as target,
                    ):
                        shutil.copyfileobj(source, target)
    os.remove(archive)
    print(f"[OK] Unpacked mpv {MPV_VERSION} runtime into {dest}")
    return dest


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python scripts/get_mpv.py <destination-dir>")
    destination = sys.argv[1]
    source = fetch_asset()
    os.makedirs(destination, exist_ok=True)
    copied = 0
    for name in os.listdir(source):
        if name == "mpv.exe" or name.endswith(".dll"):
            shutil.copy2(os.path.join(source, name), os.path.join(destination, name))
            copied += 1
    if not os.path.isfile(os.path.join(destination, "mpv.exe")):
        raise SystemExit("[ERROR] mpv.exe was not staged")
    print(f"[OK] Staged {copied} runtime files into {destination}")


if __name__ == "__main__":
    main()
