param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$Out = "",
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Delta = -3,
  [int]$Key = 0x23,
  [string]$Process = "aniplayer"
)

# Win32 primitives for driving and screenshotting the running Aniplayer window.
# Evidence helper for issue #60 — not part of the app. Adds `enum`, which lists every
# top-level window the process owns: the single-window claim is only observable from outside.

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr arg);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
}
"@

$proc = Get-Process -Name $Process -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $proc) { Write-Error "no process named '$Process'"; exit 2 }
$h = $proc.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { Write-Error "process $Process has no main window"; exit 2 }

function Get-Rect {
  $r = New-Object W+RECT
  [W]::GetWindowRect($h, [ref]$r) | Out-Null
  return $r
}

switch ($Action) {
  "rect" {
    $r = Get-Rect
    Write-Output "pid=$($proc.Id) hwnd=$h rect=$($r.L),$($r.T),$($r.R),$($r.B) size=$($r.R - $r.L)x$($r.B - $r.T)"
  }
  "enum" {
    $lines = New-Object System.Collections.Generic.List[string]
    $cb = [W+EnumProc] {
      param($hwnd, $lparam)
      $pid2 = 0
      [W]::GetWindowThreadProcessId($hwnd, [ref]$pid2) | Out-Null
      if ($pid2 -eq $proc.Id -and [W]::IsWindowVisible($hwnd)) {
        $len = [W]::GetWindowTextLength($hwnd)
        $text = New-Object System.Text.StringBuilder ($len + 1)
        [W]::GetWindowText($hwnd, $text, $text.Capacity) | Out-Null
        $r2 = New-Object W+RECT
        [W]::GetWindowRect($hwnd, [ref]$r2) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [W]::GetClassName($hwnd, $cls, $cls.Capacity) | Out-Null
        $style = [W]::GetWindowLong($hwnd, -16)
        $exStyle = [W]::GetWindowLong($hwnd, -20)
        $lines.Add("visible window hwnd=$hwnd class=`"$($cls.ToString())`" title=`"$($text.ToString())`" rect=$($r2.L),$($r2.T),$($r2.R),$($r2.B) size=$($r2.R - $r2.L)x$($r2.B - $r2.T) style=0x$($style.ToString('X8')) exStyle=0x$($exStyle.ToString('X8'))")
      }
      return $true
    }
    [W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
    Write-Output "pid=$($proc.Id) visible top-level windows: $($lines.Count)"
    $lines | ForEach-Object { Write-Output $_ }
  }
  "focus" {
    [W]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 400
    Write-Output "focused hwnd=$h"
  }
  "shot" {
    [W]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 500
    $r = Get-Rect
    $w = $r.R - $r.L
    $hh = $r.B - $r.T
    $bmp = New-Object System.Drawing.Bitmap $w, $hh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size $w, $hh))
    $full = [System.IO.Path]::GetFullPath($Out)
    New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
    $bmp.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output "saved $full ($w x $hh)"
  }
  "key" {
    [W]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 250
    $r = Get-Rect
    [W]::SetCursorPos($r.L + $X, $r.T + $Y) | Out-Null
    [W]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
    [W]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 250
    $vk = [uint32]$Key
    [W]::keybd_event($vk, 0, 0, [IntPtr]::Zero)
    [W]::keybd_event($vk, 0, 2, [IntPtr]::Zero)
    Write-Output "sent key $Key after clicking ($X,$Y)"
  }
  "move" {
    $r = Get-Rect
    [W]::SetCursorPos($r.L + $X, $r.T + $Y) | Out-Null
    Write-Output "moved to screen ($($r.L + $X),$($r.T + $Y))"
  }
  "wheel" {
    $r = Get-Rect
    [W]::SetCursorPos($r.L + $X, $r.T + $Y) | Out-Null
    Start-Sleep -Milliseconds 200
    [W]::mouse_event(0x0800, 0, 0, [uint32]([int]$Delta * 120), [IntPtr]::Zero)
    Write-Output "wheeled $Delta at ($X,$Y)"
  }
  "click" {
    $r = Get-Rect
    $sx = $r.L + $X
    $sy = $r.T + $Y
    [W]::SetForegroundWindow($h) | Out-Null
    Start-Sleep -Milliseconds 250
    [W]::SetCursorPos($sx, $sy) | Out-Null
    Start-Sleep -Milliseconds 150
    [W]::mouse_event(2, 0, 0, 0, [IntPtr]::Zero)
    [W]::mouse_event(4, 0, 0, 0, [IntPtr]::Zero)
    Write-Output "clicked window-offset ($X,$Y) -> screen ($sx,$sy)"
  }
  default { Write-Error "unknown action $Action"; exit 3 }
}
