#!/usr/bin/env python3
"""
Census of what the AniLiberty HLS catalog actually declares.

#64 asks whether the stream can carry a text track at all. A segmented subtitle in HLS is a
Rendition that only a Master Playlist may name — RFC 8216 §4.3.4 puts `#EXT-X-MEDIA` among the
Master Playlist tags and forbids those in a Media Playlist — so the answer is decided by the tags
the delivered playlists really carry. This probe walks a sample of Releases across all three
Quality tiers, reports the complete tag set it found, and counts the torrents the catalog marks
hardsub: the same Releases' soft subs live in the torrent payload, not in the stream.

Evidence helper for #64, not part of the app.
"""

import argparse
import json
import re
import subprocess
import sys
from collections import Counter

API = "https://aniliberty.top/api/v1"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Aniplayer/1.0"
)
# The tags an HLS playlist may use to announce a text rendition, and the ones the player would
# need to fetch it: searched for explicitly so "absent" is a measurement, not a guess.
TEXT_TRACK_TAGS = re.compile(r"#EXT-X-MEDIA:|\.vtt\b|\.srt\b")
TAG_LINE = re.compile(r"^#(EXT-X-[A-Z0-9-]+|[A-Z0-9-]+)")


class FetchError(RuntimeError):
    """A URL the API or the CDN refused: named in the report rather than swallowed."""


def get(url, timeout=25):
    proc = subprocess.run(
        ["curl", "-sS", "-L", "--fail", "--max-time", str(timeout), "-A", UA, url],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        reason = proc.stderr.decode(errors="replace")[:200]
        raise FetchError(f"{url} -> curl {proc.returncode}: {reason}")
    return proc.stdout.decode("utf-8", "replace")


def get_json(url):
    return json.loads(get(url))


def release_ids(recent_count, spread_count, spread_step):
    """
    The recent Releases the feed lists, interleaved with a walk backwards through the id range the
    catalog occupies. AniLiberty's numbering starts between 8000 and 8800 — 8000 answers 404, 8800
    answers 200 — and ids inside the range are not dense, so some candidates 404 and are recorded
    as skipped rather than silently missing. Interleaved because one new Release carries
    twenty-five Episodes and would otherwise eat the whole playlist budget before a single older
    encoding reached the census.
    """
    latest = [
        item["id"]
        for item in get_json(f"{API}/anime/releases/latest?limit={recent_count}")
    ]
    newest = max(latest)
    spread = [
        newest - step
        for step in range(spread_step, spread_step * (spread_count + 1), spread_step)
    ]
    return (
        [id_ for pair in zip(latest, spread) for id_ in pair]
        + latest[len(spread) :]
        + spread[len(latest) :]
    )


def episode_tiers(release, max_episodes):
    """
    Every Quality tier of a spread of the Release's Episodes, not just its first ones. A tier the
    Episode does not publish arrives as None, so a missing playlist is a counted fact rather than
    a silently smaller sample.
    """
    episodes = release.get("episodes") or []
    picks = [
        episodes[int((k + 1) * len(episodes) / (max_episodes + 1))]
        for k in range(min(max_episodes, len(episodes)))
    ]
    for episode in picks:
        for tier in ("480", "720", "1080"):
            url = episode.get(f"hls_{tier}")
            yield tier, url


def census(release_ids, target_releases, max_playlists, episodes_per_release):
    tags = Counter()
    tiers = Counter()
    playlist_kind = Counter()
    codecs = Counter()
    text_bearing = []
    hardsub = Counter()
    read = []
    skipped = []
    fetched = 0
    tiers_declared = 0
    tiers_absent = Counter()
    unreachable = 0
    for release_id in release_ids:
        if fetched >= max_playlists or len(read) >= target_releases:
            break
        try:
            release = get_json(f"{API}/anime/releases/{release_id}")
        except FetchError as err:
            print(f"release {release_id} skipped: {err}", file=sys.stderr)
            skipped.append(release_id)
            continue
        if not release.get("episodes"):
            skipped.append(release_id)
            continue
        read.append(release_id)
        for torrent in release.get("torrents") or []:
            hardsub[f"is_hardsub={torrent.get('is_hardsub')}"] += 1
        for tier, url in episode_tiers(release, episodes_per_release):
            tiers_declared += 1
            if fetched >= max_playlists:
                break
            if not url:
                tiers_absent[tier] += 1
                continue
            clean_url = url.split("?")[0]
            fetched += 1
            tiers[tier] += 1
            try:
                body = get(url)
            except FetchError as err:
                print(f"playlist {clean_url} failed: {err}", file=sys.stderr)
                unreachable += 1
                continue
            tags.update(
                match.group(1)
                for line in body.splitlines()
                if (match := TAG_LINE.match(line.strip()))
            )
            playlist_kind["master" if "#EXT-X-STREAM-INF" in body else "media"] += 1
            codecs.update(re.findall(r'CODECS="([^"]+)"', body))
            if TEXT_TRACK_TAGS.search(body):
                text_bearing.append(clean_url)
    return {
        "releases": len(read),
        "release_ids": read,
        "releases_skipped": skipped,
        "playlists": fetched,
        "tiers_declared": tiers_declared,
        "tiers_absent_from_the_episode": dict(tiers_absent),
        "tiers": dict(tiers),
        "playlist_kind": dict(playlist_kind),
        "tags": dict(tags.most_common()),
        "codecs_attribute": dict(codecs),
        "playlists_naming_a_text_track": text_bearing,
        "playlists_unreachable": unreachable,
        "torrent_hardsub_census": dict(hardsub),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--releases", type=int, default=25, help="releases to sample")
    ap.add_argument(
        "--spread-step",
        type=int,
        default=56,
        help="id step walking back through the range the catalog occupies",
    )
    ap.add_argument("--max-playlists", type=int, default=240)
    ap.add_argument("--episodes-per-release", type=int, default=3)
    args = ap.parse_args()

    ids = release_ids(args.releases, args.releases, args.spread_step)
    print(
        json.dumps(
            census(ids, args.releases, args.max_playlists, args.episodes_per_release),
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except FetchError as err:
        # A census that silently sampled half the catalog would still print confident numbers.
        print(f"census aborted: {err}", file=sys.stderr)
        sys.exit(1)
