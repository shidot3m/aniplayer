"""Verifies the release artifact set before it is published.

Three files go out together ([ADR 0016](../docs/adr/0016-portable-archive-and-per-user-nsis-installer.md)):
the portable archive, the per-user installer, and the checksums covering both. A release
missing one of them is a release the user cannot verify or cannot install the way they chose,
so this runs between the build and `gh release upload` and fails the pipeline on any gap.
"""

import hashlib
import os
import sys
import zipfile

PORTABLE_ASSET = "Aniplayer-portable.zip"
INSTALLER_ASSET = "Aniplayer-setup.exe"
SUMS_ASSET = "SHA256SUMS.txt"

# The archive is the executable and an empty data/ folder. A media runtime or a shader chain
# would mean playback left the webview again ([ADR 0014](../docs/adr/0014-webview-is-the-only-playback-backend.md)).
FORBIDDEN_PREFIXES = ("mpv/", "shaders/")

# Tauri's NSIS output is a few megabytes even for this app; anything smaller is a stub or a
# truncated copy, and an installer that will not run is worse than no installer at all.
MINIMUM_INSTALLER_BYTES = 1_000_000

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def report(problems):
    for problem in problems:
        print(f"[ERROR] {problem}")
    if problems:
        return 1
    print(
        f"\n[SUCCESS] Release set verified: {PORTABLE_ASSET}, {INSTALLER_ASSET}, {SUMS_ASSET}"
    )
    return 0


def check_files_exist(problems):
    """The artifacts actually on disk; every later check needs its own file present to say anything."""
    present = set()
    for name in (PORTABLE_ASSET, INSTALLER_ASSET, SUMS_ASSET):
        path = os.path.join(ROOT_DIR, name)
        if not os.path.isfile(path):
            problems.append(
                f"{name} is missing; run the build and checksum steps first"
            )
            continue
        present.add(name)
        print(f"[OK] {name} = {os.path.getsize(path):,} bytes")
    return present


def check_archive(problems):
    path = os.path.join(ROOT_DIR, PORTABLE_ASSET)
    with zipfile.ZipFile(path) as archive:
        entries = [info.filename.replace("\\", "/") for info in archive.infolist()]
    if "aniplayer.exe" not in entries:
        problems.append(f"{PORTABLE_ASSET} has no aniplayer.exe at its root: {entries}")
    if "data/" not in entries:
        problems.append(f"{PORTABLE_ASSET} has no empty data/ folder: {entries}")
    offenders = [e for e in entries if e.startswith(FORBIDDEN_PREFIXES)]
    if offenders:
        problems.append(
            f"{PORTABLE_ASSET} carries a media runtime or a shader chain: {offenders}"
        )
    leaked = [e for e in entries if e.startswith("downloads/")]
    if leaked:
        problems.append(f"{PORTABLE_ASSET} carries someone's downloads: {leaked[:5]}")
    if not offenders and not leaked:
        print(
            "[OK] archive = aniplayer.exe + empty data/, no runtime, no shaders, no user data"
        )


def check_installer(problems):
    path = os.path.join(ROOT_DIR, INSTALLER_ASSET)
    size = os.path.getsize(path)
    if size < MINIMUM_INSTALLER_BYTES:
        problems.append(
            f"{INSTALLER_ASSET} is {size:,} bytes, under the {MINIMUM_INSTALLER_BYTES:,} "
            "floor a real NSIS build clears"
        )
    else:
        print(f"[OK] installer is a {size:,} byte NSIS package")


def check_sums(problems):
    path = os.path.join(ROOT_DIR, SUMS_ASSET)
    with open(path, encoding="ascii") as handle:
        lines = [line for line in handle.read().splitlines() if line.strip()]

    listed = {}
    for line in lines:
        # The portable format `sha256sum` writes: hex, two spaces for text mode, then the name.
        digest, _, name = line.partition("  ")
        if len(digest) != 64 or not name:
            problems.append(f"{SUMS_ASSET} line is not `sha256sum` format: {line!r}")
            continue
        listed[name] = digest.lower()

    if set(listed) != {PORTABLE_ASSET, INSTALLER_ASSET}:
        problems.append(
            f"{SUMS_ASSET} must cover exactly {PORTABLE_ASSET} and {INSTALLER_ASSET}, "
            f"got {sorted(listed)}"
        )

    for name, digest in sorted(listed.items()):
        artifact = os.path.join(ROOT_DIR, name)
        if not os.path.isfile(artifact):
            continue
        actual = sha256(artifact)
        if actual != digest:
            problems.append(f"{name} does not match {SUMS_ASSET}: {actual} != {digest}")
        else:
            print(f"[OK] {name} matches its recorded digest")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_release():
    print("=== Verifying the Aniplayer release artifact set ===")
    problems = []
    present = check_files_exist(problems)
    if PORTABLE_ASSET in present:
        check_archive(problems)
    if INSTALLER_ASSET in present:
        check_installer(problems)
    if SUMS_ASSET in present:
        check_sums(problems)
    return report(problems)


if __name__ == "__main__":
    sys.exit(verify_release())
