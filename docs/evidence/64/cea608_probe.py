#!/usr/bin/env python3
"""
Does a catalog segment carry a text track at all?

The one way an AniLiberty MPEG-TS stream could still hand the webview captions is CEA-608
wrapped in a CEA-708 SEI message: hls.js reads exactly `user_data_registered_itu_t_t35`
(payloadType 4) with country 0xB5, provider 0x0031, structure 'GA94' and userDataType 3, and
from that alone it creates a native captions track. This probe demuxes real segments, lists the
elementary streams the PMT declares, and histograms every SEI payload it finds, so the answer
names what is really in the stream instead of what fansub releases usually do.

Evidence helper for #64, not part of the app. `--selftest` proves the detector fires.
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
VIDEO_TYPES = {
    0x1B: "AVC",
    0x24: "HEVC",
    0x27: "HEVC",
    0x0F: "AAC-ADTS",
    0x11: "AAC-LATM",
    0x03: "MP1",
    0x04: "MP2",
    0x06: "ATSC A/52 (CEA-608 in TS)",
    0x81: "AC-3",
    0x15: "ID3 metadata",
    0x09: "metadata",
}
CEA608_HEADER = bytes([0xB5, 0x00, 0x31, ord("G"), ord("A"), ord("9"), ord("4")])


class FetchError(RuntimeError):
    """A URL the CDN or the API refused: reported by name, never swallowed."""


# Segments are pulled through curl, whose TLS verdict is the one the app's own stack reaches:
# urllib in this Python build rejects an expired intermediate on one CDN backend, and a probe
# that cannot read the bytes measures nothing. The URL is passed as an argument, never through a
# shell, so a catalog-provided URL cannot become a command.
def get(url, timeout=60):
    proc = subprocess.run(
        ["curl", "-sS", "-L", "--fail", "--max-time", str(timeout), "-A", UA, url],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        reason = proc.stderr.decode(errors="replace")[:200]
        raise FetchError(f"{url} -> curl {proc.returncode}: {reason}")
    return proc.stdout


def get_json(url):
    return json.loads(get(url))


def is_pes_start(payload):
    return payload[:3] == b"\x00\x00\x01" and len(payload) > 9


def demux(data):
    """Return ({pid: stream_type}, [(pid, payload, unit_start)]) for one TS blob."""
    pmt_pid = None
    es_streams = {}
    packets = []
    for i in range(0, len(data) - len(data) % 188, 188):
        pkt = data[i : i + 188]
        if pkt[0] != 0x47:
            continue
        pusi = bool(pkt[1] & 0x40)
        pid = ((pkt[1] & 0x1F) << 8) | pkt[2]
        afc = (pkt[3] & 0x30) >> 4
        offset = 5 + pkt[4] if afc in (2, 3) else 4
        if afc not in (1, 3) or offset >= 188:
            continue
        payload = pkt[offset:]
        # A section is `section_length` bytes past its 3-byte header and ends with a 4-byte CRC;
        # reading on turns the filler into phantom elementary streams.
        if pusi and len(payload) > 12:
            body = payload[payload[0] + 1 :]
            end = 3 + (((body[1] & 0x0F) << 8) | body[2]) - 4
            if body[0] == 0x00:
                pmt_pid = next(
                    (
                        ((body[j + 2] & 0x1F) << 8) | body[j + 3]
                        for j in range(8, min(len(body), end), 4)
                        if (body[j] << 8) | body[j + 1]
                    ),
                    pmt_pid,
                )
            elif pid == pmt_pid and body[0] == 0x02:
                j = 12 + (((body[10] & 0x0F) << 8) | body[11])
                while j + 5 <= end:
                    es_streams[((body[j + 1] & 0x1F) << 8) | body[j + 2]] = body[j]
                    j += 5 + (((body[j + 3] & 0x0F) << 8) | body[j + 4])
        packets.append((pid, payload, pusi))
    return es_streams, packets


def elementary_stream(packets, pid):
    """Strip PES headers so the bytes left are the raw elementary stream."""
    es = bytearray()
    for p, payload, pusi in packets:
        if p != pid:
            continue
        if pusi and is_pes_start(payload):
            header_len = 9 + payload[8]
            if header_len <= len(payload):
                payload = payload[header_len:]
        es += payload
    return bytes(es)


def strip_epb(nal):
    """Undo the emulation-prevention bytes, so a NAL can be read as its own bytes."""
    out = bytearray()
    i = 0
    while i < len(nal):
        if nal[i : i + 3] == b"\x00\x00\x03":
            out += nal[i : i + 2]
            i += 3
        else:
            out.append(nal[i])
            i += 1
    return bytes(out)


def nals(es):
    for part in re.split(b"\x00\x00\x01", es):
        if part[:1] == b"\x00":
            part = part[1:]
        if len(part) > 2:
            yield strip_epb(part)


def parse_sei(nal):
    """Return [(payloadType, payload)] for one AVC SEI NAL unit."""
    if nal[0] & 0x1F != 6:
        return []
    data = nal[1:]
    msgs = []
    i = 0
    while i < len(data) - 1:
        ptype, i = read_length(data, i)
        psize, i = read_length(data, i)
        if i > len(data):
            break
        payload = data[i : i + psize]
        i += psize
        msgs.append((ptype, payload))
    return msgs


def read_length(data, i):
    """An SEI length field: 0xFF repeated, then a final byte that is added as well."""
    total = 0
    while i < len(data) and data[i] == 0xFF:
        total += 0xFF
        i += 1
    if i >= len(data):
        return total, len(data) + 1
    return total + data[i], i + 1


class Census:
    """What the scanned segments say, counted as they arrive."""

    def __init__(self):
        self.segments = 0
        self.bytes_read = 0
        self.es_bytes = 0
        self.stream_types = Counter()
        self.nal_types = Counter()
        self.sei_types = Counter()
        self.itu_t35 = Counter()
        self.cea608_messages = 0
        self.truncated = 0
        self.rows = []

    def add_segment(self, sample):
        blob = sample["blob"]
        self.segments += 1
        self.bytes_read += sample["bytes"]
        self.truncated += int(sample["truncated"])
        es_streams, packets = demux(blob)
        self.stream_types.update(
            f"{stype:#02x} {VIDEO_TYPES.get(stype, '?')}"
            for stype in es_streams.values()
        )
        signatures = self.scan_video_streams(es_streams, packets)
        self.rows.append(
            {
                "release": sample["release"],
                "episode": sample["episode"],
                "tier": sample["tier"],
                "segment": sample["uri"].split("/")[-1],
                "size": sample["bytes"],
                "truncated": sample["truncated"],
                "pids": sorted(
                    f"{pid}:{VIDEO_TYPES.get(st, hex(st))}"
                    for pid, st in es_streams.items()
                ),
                "itu_t35": signatures,
            }
        )

    def scan_video_streams(self, es_streams, packets):
        signatures = Counter()
        for pid, stype in es_streams.items():
            if stype not in (0x1B, 0x24, 0x27):
                continue
            es = elementary_stream(packets, pid)
            self.es_bytes += len(es)
            for nal in nals(es):
                # The NAL census is the positive control: it proves the elementary stream really
                # is being read, so "no SEI" is a fact about the segment, not about this parser.
                self.nal_types[f"{nal[0] & 0x1F:#02x}"] += 1
                for payload_type, payload in parse_sei(nal):
                    self.sei_types[payload_type] += 1
                    if payload_type == 4 and len(payload) >= 8:
                        self.count_t35(payload, signatures)
        return signatures

    def count_t35(self, payload, signatures):
        provider = int.from_bytes(payload[1:3], "big")
        structure = payload[3:7].decode("latin-1", "replace")
        self.itu_t35[
            f"country={payload[0]:#02x} provider={provider:#04x} struct={structure}"
        ] += 1
        signatures[f"{structure}/{provider:#04x}"] += 1
        if payload[:7] == CEA608_HEADER and payload[7] == 3:
            self.cea608_messages += 1

    def report(self):
        return {
            "segments": self.segments,
            "bytes": self.bytes_read,
            "video_es_bytes": self.es_bytes,
            "pmt_stream_types": dict(self.stream_types),
            "avc_nal_types": dict(self.nal_types),
            "sei_payload_types": {str(k): v for k, v in self.sei_types.items()},
            "itu_t_t35_signatures": dict(self.itu_t35),
            "cea608_ga94_messages": self.cea608_messages,
            "segments_read_in_full": self.segments - self.truncated,
            "per_segment": self.rows,
        }


def selftest():
    """
    The negative result is only worth anything if the detector fires on a positive, so the
    GA94 message hls.js looks for is built here byte for byte and pushed through the same
    parser: SEI NAL (type 6), payloadType 4, country 0xB5, provider 0x0031, 'GA94',
    userDataType 3, `enabled` + two cc_data pairs.
    """
    cc = bytes([0xFA, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])
    payload = bytes([0xB5, 0x00, 0x31]) + b"GA94" + bytes([0x03, 0x42]) + cc[:5]
    sei = bytes([0x06, 0x04, len(payload)]) + payload + b"\x80"
    census = Census()
    for nal in nals(b"\x00\x00\x00\x01" + sei):
        for payload_type, body in parse_sei(nal):
            if payload_type == 4 and len(body) >= 8:
                census.count_t35(body, Counter())
    return {
        "detector_fires_on_synthetic_ga94": census.cea608_messages == 1,
        "messages": census.cea608_messages,
    }


def spread(items, count):
    """Evenly spread picks across a list, so a sample is not just its first minutes."""
    return [
        items[int((k + 1) * len(items) / (count + 1))]
        for k in range(min(count, len(items)))
    ]


def playlist_uris(url):
    try:
        body = get(url).decode("utf-8", "replace")
    except FetchError as err:
        print(f"playlist {url} failed: {err}", file=sys.stderr)
        return []
    return [
        line.strip()
        for line in body.splitlines()
        if line.strip() and not line.startswith("#")
    ]


def episode_samples(release_id, episodes_per_release, tiers):
    """
    A spread of the Release's Episodes at the named Quality tiers, each with the segment URIs its
    playlist declares — the same Releases the playlist census walked, so the two measurements
    describe one sample rather than two hand-picked ones.
    """
    try:
        release = get_json(f"{API}/anime/releases/{release_id}")
    except FetchError as err:
        print(f"release {release_id} skipped: {err}", file=sys.stderr)
        return []
    episodes = spread(
        [e for e in release.get("episodes") or [] if e.get("hls_720")],
        episodes_per_release,
    )
    if not episodes:
        print(f"release {release_id} has no HLS episode", file=sys.stderr)
        return []
    samples = []
    for episode in episodes:
        for tier in tiers:
            url = episode.get(f"hls_{tier}")
            if not url:
                continue
            uris = playlist_uris(url)
            if uris:
                samples.append(
                    {
                        "release": release_id,
                        "episode": episode.get("ordinal"),
                        "tier": f"{tier}p",
                        "uris": uris,
                    }
                )
    return samples


def scan(
    census, release_ids, segments_per_episode, episodes_per_release, tiers, max_bytes
):
    for release_id in release_ids:
        for sample in episode_samples(release_id, episodes_per_release, tiers):
            for uri in spread(sample["uris"], segments_per_episode):
                try:
                    blob = get(uri)
                except FetchError as err:
                    print(f"segment failed {err}", file=sys.stderr)
                    continue
                census.add_segment(
                    {
                        **{k: sample[k] for k in ("release", "episode", "tier")},
                        "uri": uri,
                        "bytes": len(blob),
                        "truncated": len(blob) > max_bytes,
                        "blob": blob[:max_bytes],
                    },
                )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--releases", type=str, default="", help="comma-separated release ids"
    )
    ap.add_argument("--segments-per-episode", type=int, default=3)
    ap.add_argument("--max-bytes", type=int, default=12 << 20)
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument(
        "--releases-from",
        type=str,
        default="",
        help="a catalog_probe.py report to walk the same Releases it sampled",
    )
    ap.add_argument("--episodes-per-release", type=int, default=2)
    ap.add_argument(
        "--tiers", type=str, default="1080,720", help="comma-separated Quality tiers"
    )
    args = ap.parse_args()

    if args.selftest:
        print(json.dumps(selftest(), indent=2))
        return

    if args.releases_from:
        with open(args.releases_from, encoding="utf-8") as record:
            ids = json.load(record)["release_ids"]
    elif args.releases:
        ids = [int(x) for x in args.releases.split(",")]
    else:
        ids = [r["id"] for r in get_json(f"{API}/anime/releases/latest?limit=6")]
    census = Census()
    scan(
        census,
        ids,
        args.segments_per_episode,
        args.episodes_per_release,
        [tier.strip() for tier in args.tiers.split(",")],
        args.max_bytes,
    )
    print(json.dumps(census.report(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
