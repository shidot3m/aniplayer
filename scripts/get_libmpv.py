"""Fetch the pinned libmpv runtime and stage it beside a build of the app.

`scripts/get_mpv.py` stages the out-of-process mpv runtime; this script stages the
in-process `libmpv-2.dll` that replaces it (ADR 0012). The archive is mirrored in this
repository's own `latest` release because the upstream build repository keeps its
releases for only thirty days. Every download is verified against the pinned SHA-256
digest and cached, so a run pays the transfer once.
"""

import hashlib
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

LIBMPV_PIN = "20261103-git-46787be250-lgpl"
LIBMPV_ASSET = f"libmpv-2-{LIBMPV_PIN}.zip"
MIRROR_RELEASE = "latest"
MIRROR_REPO = "shidot3m/aniplayer"
MIRROR_URL = f"https://github.com/{MIRROR_REPO}/releases/download/{MIRROR_RELEASE}/{LIBMPV_ASSET}"
# Origin of the bytes: zhongfly/mpv-winbuild release 2026-11-03-46787be250, asset
# mpv-dev-lgpl-x86_64-20261103-git-46787be250.7z, whose digest the upstream release
# publishes in sha256.txt. The mirror repacks that archive's libmpv-2.dll unchanged.
UPSTREAM_ARCHIVE_SHA256 = (
    "ce2563d352aac81c2e6e9b2b63e846ec847f4bdabdec74fb14c5b29049c161d7"
)
LIBMPV_ZIP_SHA256 = "c53d9c77c026740c14e479dbdbb1941d76585b2219ced79ca4c92cf65f33da15"
LIBMPV_DLL_SHA256 = "63afb25809223c2893bdbcdbc7aa744cf32739cba403dcf0c8ca38a2858589e8"
RUNTIME_FILES = ("libmpv-2.dll", "LICENSE.libmpv", "LICENSE.ffmpeg", "NOTICE.md")


def runtime_dir():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(root, ".cache", "libmpv-" + LIBMPV_PIN)


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(path, expected, label):
    actual = sha256_of(path)
    if actual != expected:
        os.remove(path)
        raise SystemExit(
            f"[ERROR] {label} digest mismatch: pinned {expected}, got {actual}"
        )


def download_with_gh(dest):
    gh = shutil.which("gh")
    if not gh:
        return None
    result = subprocess.run(
        [
            gh,
            "release",
            "download",
            MIRROR_RELEASE,
            "--repo",
            MIRROR_REPO,
            "--pattern",
            LIBMPV_ASSET,
            "--dir",
            dest,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(
            f"[..] gh could not fetch the mirror ({result.stderr.strip()}); trying plain HTTPS"
        )
        return None
    return os.path.join(dest, LIBMPV_ASSET)


def download_anonymously(dest):
    target = os.path.join(dest, LIBMPV_ASSET)
    request = urllib.request.Request(MIRROR_URL)
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    try:
        with (
            urllib.request.urlopen(request, timeout=120) as response,
            open(target, "wb") as handle,
        ):
            shutil.copyfileobj(response, handle)
    except urllib.error.HTTPError as error:
        if os.path.exists(target):
            os.remove(target)
        raise SystemExit(
            f"[ERROR] {MIRROR_URL} returned HTTP {error.code}. The libmpv mirror is an asset of "
            f"the private {MIRROR_REPO} release, so fetching it needs credentials: run "
            "`gh auth login`, or export GITHUB_TOKEN/GH_TOKEN."
        )
    except OSError as error:
        if os.path.exists(target):
            os.remove(target)
        raise SystemExit(f"[ERROR] could not download {MIRROR_URL}: {error}")
    return target


def fetch_archive(dest):
    archive = download_with_gh(dest) or download_anonymously(dest)
    verify(archive, LIBMPV_ZIP_SHA256, LIBMPV_ASSET)
    print("[OK] SHA-256 verified for the pinned libmpv archive")
    return archive


def unpack(archive, dest):
    with zipfile.ZipFile(archive) as package:
        names = set(package.namelist())
        missing = [name for name in RUNTIME_FILES if name not in names]
        if missing:
            raise SystemExit(f"[ERROR] {archive} does not carry {missing}")
        for name in RUNTIME_FILES:
            with (
                package.open(name) as source,
                open(os.path.join(dest, name), "wb") as target,
            ):
                shutil.copyfileobj(source, target)
    os.remove(archive)


def fetch_asset():
    dest = runtime_dir()
    dll = os.path.join(dest, "libmpv-2.dll")
    if os.path.isfile(dll) and sha256_of(dll) == LIBMPV_DLL_SHA256:
        print(f"[OK] Reusing cached libmpv runtime at {dest}")
        return dest
    if os.path.isdir(dest) and not os.path.isfile(dll):
        print(f"[..] Cache at {dest} holds no usable libmpv-2.dll; refetching")
    os.makedirs(dest, exist_ok=True)
    unpack(fetch_archive(dest), dest)
    verify(dll, LIBMPV_DLL_SHA256, "cached libmpv-2.dll")
    print(f"[OK] Unpacked libmpv {LIBMPV_PIN} runtime into {dest}")
    return dest


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python scripts/get_libmpv.py <destination-dir>")
    destination = sys.argv[1]
    source = fetch_asset()
    if not os.path.isfile(os.path.join(source, "libmpv-2.dll")):
        raise SystemExit(f"[ERROR] {source} is empty: libmpv-2.dll was never cached")
    os.makedirs(destination, exist_ok=True)
    for name in RUNTIME_FILES:
        shutil.copy2(os.path.join(source, name), os.path.join(destination, name))
    verify(
        os.path.join(destination, "libmpv-2.dll"),
        LIBMPV_DLL_SHA256,
        "staged libmpv-2.dll",
    )
    print(f"[OK] Staged {len(RUNTIME_FILES)} runtime files into {destination}")


if __name__ == "__main__":
    main()
