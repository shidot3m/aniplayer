"""Win32 glue for the libmpv gate spike: a plain window, its message pump, a screen capture.

Part of `docs/evidence/54` — see README.md.
"""

import ctypes
from ctypes import wintypes

P, I = ctypes.c_void_p, ctypes.c_int
user32 = ctypes.WinDLL("user32", use_last_error=True)

gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)

SIGNATURES = (
    (user32.RegisterClassExW, [P], wintypes.ATOM),
    (
        user32.CreateWindowExW,
        [
            wintypes.DWORD,
            wintypes.LPCWSTR,
            wintypes.LPCWSTR,
            wintypes.DWORD,
            I,
            I,
            I,
            I,
            wintypes.HWND,
            wintypes.HMENU,
            wintypes.HINSTANCE,
            wintypes.LPVOID,
        ],
        wintypes.HWND,
    ),
    (user32.ShowWindow, [wintypes.HWND, I], I),
    (user32.UpdateWindow, [wintypes.HWND], wintypes.BOOL),
    (user32.DestroyWindow, [wintypes.HWND], wintypes.BOOL),
    (
        user32.DefWindowProcW,
        [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM],
        wintypes.LPARAM,
    ),
    (user32.GetWindowRect, [wintypes.HWND, P], wintypes.BOOL),
    (user32.GetDC, [wintypes.HWND], wintypes.HDC),
    (user32.ReleaseDC, [wintypes.HWND, wintypes.HDC], I),
    (
        user32.PeekMessageW,
        [P, wintypes.HWND, wintypes.UINT, wintypes.UINT, wintypes.UINT],
        wintypes.BOOL,
    ),
    (user32.TranslateMessage, [P], wintypes.BOOL),
    (user32.DispatchMessageW, [P], ctypes.c_ssize_t),
    (gdi32.GetStockObject, [I], wintypes.HGDIOBJ),
    (gdi32.CreateCompatibleDC, [wintypes.HDC], wintypes.HDC),
    (gdi32.CreateCompatibleBitmap, [wintypes.HDC, I, I], wintypes.HGDIOBJ),
    (gdi32.SelectObject, [wintypes.HDC, wintypes.HGDIOBJ], wintypes.HGDIOBJ),
    (
        gdi32.BitBlt,
        [wintypes.HDC, I, I, I, I, wintypes.HDC, I, I, wintypes.DWORD],
        wintypes.BOOL,
    ),
    (
        gdi32.GetDIBits,
        [
            wintypes.HDC,
            wintypes.HGDIOBJ,
            wintypes.UINT,
            wintypes.UINT,
            wintypes.LPVOID,
            P,
            wintypes.UINT,
        ],
        I,
    ),
    (gdi32.DeleteObject, [wintypes.HGDIOBJ], wintypes.BOOL),
    (gdi32.DeleteDC, [wintypes.HDC], wintypes.BOOL),
)

for _function, _args, _returns in SIGNATURES:
    _function.argtypes = _args
    _function.restype = _returns


class WndClass(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint),
        ("style", ctypes.c_uint),
        ("lpfnWndProc", P),
        ("cbClsExtra", I),
        ("cbWndExtra", I),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HICON),
        ("hCursor", wintypes.HANDLE),
        ("hbrBackground", wintypes.HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
        ("hIconSm", wintypes.HICON),
    ]


class Rect(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class Msg(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("message", wintypes.UINT),
        ("wParam", wintypes.WPARAM),
        ("lParam", wintypes.LPARAM),
        ("time", wintypes.DWORD),
        ("pt", wintypes.POINT),
    ]


class BitmapInfoHeader(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


WNDPROC = ctypes.WINFUNCTYPE(
    wintypes.LPARAM, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM
)

_window_procedures = []


def make_window(title, width, height):
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
    instance = kernel32.GetModuleHandleW(None)

    def wnd_proc(hwnd, message, wparam, lparam):
        if message == 0x0010:
            user32.DestroyWindow(hwnd)
            return 0
        return user32.DefWindowProcW(hwnd, message, wparam, lparam)

    procedure = WNDPROC(wnd_proc)
    _window_procedures.append(procedure)
    cls = WndClass()
    cls.cbSize = ctypes.sizeof(WndClass)
    cls.lpfnWndProc = ctypes.cast(procedure, P)
    cls.hInstance = instance
    cls.hbrBackground = gdi32.GetStockObject(0)
    cls.lpszClassName = "aniplayer_libmpv_gate"
    if not user32.RegisterClassExW(ctypes.byref(cls)):
        raise OSError(ctypes.get_last_error(), "RegisterClassExW")
    hwnd = user32.CreateWindowExW(
        0,
        cls.lpszClassName,
        title,
        0x00CF0000,
        120,
        120,
        width,
        height,
        None,
        None,
        instance,
        None,
    )
    if not hwnd:
        raise OSError(ctypes.get_last_error(), "CreateWindowExW")
    user32.ShowWindow(hwnd, 5)
    user32.UpdateWindow(hwnd)
    return hwnd


def close_window(hwnd):
    user32.DestroyWindow(hwnd)


def pump_messages():
    msg = Msg()
    while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))


def capture_window(hwnd, path):
    """BitBlt the screen area the window occupies: proof the frame landed in this HWND."""
    rect = Rect()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    screen = user32.GetDC(None)
    width, height = rect.right - rect.left, rect.bottom - rect.top
    memory = gdi32.CreateCompatibleDC(screen)
    bitmap = gdi32.CreateCompatibleBitmap(screen, width, height)
    gdi32.SelectObject(memory, bitmap)
    if not gdi32.BitBlt(
        memory, 0, 0, width, height, screen, rect.left, rect.top, 0x00CC0020
    ):
        raise OSError(ctypes.get_last_error(), "BitBlt")
    header = BitmapInfoHeader()
    header.biSize = ctypes.sizeof(BitmapInfoHeader)
    header.biWidth, header.biHeight = width, -height
    header.biPlanes, header.biBitCount = 1, 32
    pixels = ctypes.create_string_buffer(width * height * 4)
    if (
        gdi32.GetDIBits(memory, bitmap, 0, height, pixels, ctypes.byref(header), 0)
        != height
    ):
        raise OSError(0, "GetDIBits")
    raw = pixels.raw
    with open(path, "wb") as handle:
        handle.write(
            b"BM"
            + (54 + len(raw)).to_bytes(4, "little")
            + b"\x00" * 4
            + b"\x36\x00\x00\x00"
        )
        handle.write(ctypes.string_at(ctypes.byref(header), ctypes.sizeof(header)))
        handle.write(raw)
    user32.ReleaseDC(None, screen)
    gdi32.DeleteDC(memory)
    gdi32.DeleteObject(bitmap)
    return len({raw[offset : offset + 3] for offset in range(0, len(raw), 4)})
