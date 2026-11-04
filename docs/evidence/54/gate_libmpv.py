"""Gate a candidate libmpv-2.dll: API surface, then HEVC Main 10 decoded through `wid`.

Spike for #54 and ADR 0012 — it verifies a runtime pin, it is not the player. The in-process
backend that uses this DLL for real is #56.

    python docs/evidence/54/gate_libmpv.py <libmpv-2.dll> <fixture> <out-dir>
"""

import ctypes
import json
import os
import sys
import time

from window_probe import capture_window, close_window, make_window, pump_messages

P, C, I = ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int
REQUIRED_SYMBOLS = (
    "mpv_client_api_version",
    "mpv_create",
    "mpv_create_client",
    "mpv_initialize",
    "mpv_terminate_destroy",
    "mpv_set_option_string",
    "mpv_set_property_string",
    "mpv_get_property_string",
    "mpv_free",
    "mpv_command",
    "mpv_command_string",
    "mpv_command_async",
    "mpv_observe_property",
    "mpv_request_event",
    "mpv_request_log_messages",
    "mpv_wait_event",
    "mpv_get_property",
    "mpv_set_property",
    "mpv_wakeup",
    "mpv_error_string",
    "mpv_hook_add",
)

PROBE_PROPERTIES = (
    "current-vo",
    "video-codec",
    "hwdec-current",
    "video-out-params/pixelformat",
    "video-params/pixelformat",
    "vo-configured",
    "time-pos",
    "duration",
    "estimated-vf-fps",
    "path",
    "eof-reached",
)

EVENT_LOG_MESSAGE, EVENT_END_FILE, EVENT_IDLE = 2, 7, 11

EVENT_VIDEO_RECONFIG, EVENT_PLAYBACK_RESTART = 17, 21

SNAPSHOT_EVENTS = (EVENT_VIDEO_RECONFIG, EVENT_PLAYBACK_RESTART)

P, C, I = ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int


class LogMessage(ctypes.Structure):
    _fields_ = [("prefix", C), ("level", C), ("text", C), ("log_level", I)]


class MpvEvent(ctypes.Structure):
    # event_id is a C enum (int); data follows error plus the 8-byte reply_userdata.
    _fields_ = [
        ("event_id", ctypes.c_int32),
        ("error", ctypes.c_int32),
        ("reply_userdata", ctypes.c_uint64),
        ("data", P),
    ]


def say(line):
    print(line, flush=True)


def bind(dll):
    """Set the signatures ctypes needs to pass handles, structs and string pointers."""
    for name, args in (
        ("mpv_initialize", [P]),
        ("mpv_terminate_destroy", [P]),
        ("mpv_free", [P]),
        ("mpv_command", [P, ctypes.POINTER(C)]),
        ("mpv_command_string", [P, C]),
        ("mpv_observe_property", [P, ctypes.c_uint64, C, I]),
        ("mpv_request_event", [P, I, I]),
        ("mpv_request_log_messages", [P, C]),
        ("mpv_wait_event", [P, ctypes.c_double]),
        ("mpv_set_option_string", [P, C, C]),
        ("mpv_get_property_string", [P, C]),
    ):
        getattr(dll, name).argtypes = args
    dll.mpv_create.restype = P
    dll.mpv_get_property_string.restype = P
    dll.mpv_error_string.restype = C
    dll.mpv_wait_event.restype = ctypes.POINTER(MpvEvent)
    return dll


def read_string(dll, handle, name):
    pointer = dll.mpv_get_property_string(handle, name.encode())
    if not pointer:
        return None
    value = ctypes.cast(pointer, ctypes.c_char_p).value
    dll.mpv_free(pointer)
    return value.decode(errors="replace") if value else None


def snapshot(dll, handle):
    return {name: read_string(dll, handle, name) for name in PROBE_PROPERTIES}


def command(dll, handle, *args):
    argv = (C * (len(args) + 1))(*(argument.encode() for argument in args), None)
    return dll.mpv_command(handle, argv)


def check_surface(dll, path):
    missing = [name for name in REQUIRED_SYMBOLS if not hasattr(dll, name)]
    api = dll.mpv_client_api_version()
    say(f"[OK] LoadLibrary {path}")
    say(f"     mpv_client_api_version = {api >> 16}.{api & 0xFFFF} (0x{api:08x})")
    say(
        f"     symbols resolved {len(REQUIRED_SYMBOLS) - len(missing)}/{len(REQUIRED_SYMBOLS)}, "
        f"missing={missing or 'none'}"
    )
    if missing:
        raise SystemExit("[FAIL] required symbols missing")
    return {
        "mpv_client_api_version": f"{api >> 16}.{api & 0xFFFF}",
        "symbols_missing": missing,
    }


def read_identity(dll, result):
    handle = ctypes.c_void_p(dll.mpv_create())
    for option, value in (
        ("vo", "null"),
        ("ao", "null"),
        ("terminal", "no"),
        ("msg-level", "all=no"),
    ):
        dll.mpv_set_option_string(handle, option.encode(), value.encode())
    dll.mpv_initialize(handle)
    for prop in ("mpv-version", "ffmpeg-version", "libass-version"):
        result[prop] = read_string(dll, handle, prop)
        say(f"     {prop} = {result[prop]}")
    dll.mpv_terminate_destroy(handle)


def open_player(dll, hwnd, shot_dir, result):
    handle = ctypes.c_void_p(dll.mpv_create())
    rejected = []
    for option, value in (
        ("wid", str(hwnd)),
        ("vo", "gpu-next"),
        ("hwdec", "auto-safe"),
        ("terminal", "no"),
        ("msg-level", "all=v"),
        ("config", "no"),
        ("keep-open", "yes"),
        ("screenshot-directory", shot_dir),
        ("screenshot-format", "png"),
    ):
        if dll.mpv_set_option_string(handle, option.encode(), value.encode()):
            rejected.append(option)
    result["rejected_options"] = rejected
    dll.mpv_initialize(handle)
    dll.mpv_request_log_messages(handle, b"v")
    return handle


def play(dll, handle, fixture, seconds):
    """Run the file and take a property snapshot at each reconfiguration."""
    logs, snapshots = [], []
    say(f"     loadfile rc={command(dll, handle, 'loadfile', fixture)}")
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        event = dll.mpv_wait_event(handle, 0.05)
        pump_messages()
        if not event or event.contents.event_id == 0:
            continue
        current = event.contents
        if current.event_id == EVENT_LOG_MESSAGE:
            text = ctypes.cast(current.data, ctypes.POINTER(LogMessage)).contents.text
            logs.append(text.decode(errors="replace").rstrip())
            if "VO: [" in logs[-1] or "error" in logs[-1].lower():
                say(f"    mpv| {logs[-1]}")
        elif current.event_id == EVENT_END_FILE:
            say(f"    [event] end-file error={current.error}")
        elif current.event_id in SNAPSHOT_EVENTS:
            snapshots.append(snapshot(dll, handle))
    return logs, snapshots


def report(dll, handle, hwnd, shot_dir, logs, snapshots):
    during = {}
    for snap in snapshots:
        for key, value in snap.items():
            if value and key not in during:
                during[key] = value
    command(dll, handle, "screenshot")
    for _ in range(100):
        pump_messages()
        dll.mpv_wait_event(handle, 0.05)
        if any(name.endswith(".png") for name in os.listdir(shot_dir)):
            break
    end = snapshot(dll, handle)
    found = {
        "log_lines_seen": len(logs),
        "log_tail": logs[-40:],
        "playback_during_stream": during,
        "final_snapshot": end,
        "mpv_screenshots": {
            name: os.path.getsize(os.path.join(shot_dir, name))
            for name in os.listdir(shot_dir)
            if name.endswith(".png")
        },
        "host_window_distinct_colors": capture_window(
            hwnd, os.path.join(shot_dir, "host-window.bmp")
        ),
    }
    for name in PROBE_PROPERTIES:
        say(f"       {name} = {during.get(name)}")
    say(
        f"     at the end: time-pos={end['time-pos']} of {end['duration']}, "
        f"eof-reached={end['eof-reached']}"
    )
    say(f"     mpv screenshots: {found['mpv_screenshots']}")
    say(f"     host window: {found['host_window_distinct_colors']} distinct colors")
    return found


def main():
    dll_path, fixture, shot_dir = sys.argv[1], sys.argv[2], os.path.abspath(sys.argv[3])
    os.makedirs(shot_dir, exist_ok=True)
    result = {"dll": os.path.abspath(dll_path), "fixture": os.path.abspath(fixture)}
    dll = bind(ctypes.WinDLL(os.fspath(dll_path)))
    result.update(check_surface(dll, dll_path))
    read_identity(dll, result)
    hwnd = make_window("libmpv HEVC Main 10 gate", 960, 540)
    say(f"     host HWND = 0x{hwnd:x}")
    handle = open_player(dll, hwnd, shot_dir, result)
    logs, snapshots = play(dll, handle, fixture, 10.0)
    result.update(report(dll, handle, hwnd, shot_dir, logs, snapshots))
    dll.mpv_terminate_destroy(handle)
    close_window(hwnd)
    path = os.path.join(shot_dir, "gate-result.json")
    with open(path, "w", encoding="utf-8") as handle_file:
        json.dump(result, handle_file, indent=2)
    say(f"[DONE] wrote {path}")


if __name__ == "__main__":
    main()
