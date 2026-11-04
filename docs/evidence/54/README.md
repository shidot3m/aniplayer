# Evidence for #54 — the libmpv runtime source

What the pinned `libmpv-2.dll` has to prove, and the numbers it produced on the development
machine (Windows 10.0.19045 x64, no `Microsoft.HEVCVideoExtension` installed, so no system
HEVC decoder).

| File                                | What it is                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate_libmpv.py`                    | Loads a candidate DLL, resolves the API surface, then plays the HEVC Main 10 fixture through `wid` into a window this process owns, and captures that window. |
| `window_probe.py`                   | The Win32 side of the same spike: the plain window, its message pump, and the screen capture.                                                                 |
| `gate-run.txt`                      | Console output of the run against the DLL staged by `scripts/get_libmpv.py`.                                                                                  |
| `gate-result.json`                  | Machine-readable result: digests, API version, resolved symbols, playback properties, mpv log tail.                                                           |
| `libmpv-wid-hevc-main10-client.png` | Screen capture of the host window's client area while mpv rendered into it.                                                                                   |
| `libmpv-screenshot-hevc-main10.png` | The frame mpv itself wrote with the `screenshot` command.                                                                                                     |

Reproduce:

```bash
python scripts/get_libmpv.py .cache/stage-test
python docs/evidence/54/gate_libmpv.py .cache/stage-test/libmpv-2.dll \
    src-tauri/tests/fixtures/hevc_aac.mkv .cache/gate-out
```

The harness is a spike, not shipped code: it exists so the gate in
[ADR 0012](../../adr/0012-libmpv-runtime-is-a-pinned-mirrored-lgpl-build.md) can be re-run
against a new pin. The in-process backend that will use this DLL for real is
[#56](https://github.com/shidot3m/aniplayer/issues/56).

Observed on the pinned artifact (`20261103-git-46787be250-lgpl`):

```
mpv_client_api_version = 2.6 (0x00020006)
symbols resolved 21/21, missing=none
mpv-version = mpv v0.41.0-1434-g46787be25
ffmpeg-version = N-128356-gb8f159858
VO: [gpu-next] 128x96 yuv420p10
video-codec = H.265 / HEVC (High Efficiency Video Coding)
video-out-params/pixelformat = yuv420p10
hwdec-current = no            # the bundled decoder, not a system one
at the end: time-pos=4.016845 of 4.023000, eof-reached=yes
mpv screenshots: {'mpv-shot0001.png': 43377}
host window: 67144 distinct colors
```

The same gate passed for the GPL flavor of the same release and for
`shinchiro/mpv-winbuild-cmake` `20261103`, so the choice between those builds is a licensing
choice rather than a capability one.

Two traps worth carrying into #56:

- In `mpv_event` the `event_id` field is a C enum (`int`), not a 64-bit value, and `data`
  follows `error` plus the 8-byte `reply_userdata`. Reading the payload from the wrong
  offset segfaults the host process.
- Log lines arrive only after `mpv_request_log_messages`, which is a separate call from
  `mpv_request_event`.
