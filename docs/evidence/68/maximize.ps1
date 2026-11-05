param([string]$Process = "aniplayer", [ValidateSet("maximize", "restore")][string]$Mode = "maximize")

# Brings the Aniplayer window to a known size so a screen capture of its rectangle is not
# contaminated by whatever terminal sits behind it. Evidence helper for issue #68 — not part
# of the app.

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class M {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@

$proc = Get-Process -Name $Process -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $proc) { Write-Error "no process named '$Process'"; exit 2 }
$h = $proc.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { Write-Error "process $Process has no main window"; exit 2 }

$n = if ($Mode -eq "maximize") { 3 } else { 9 }
[M]::ShowWindow($h, $n) | Out-Null
Start-Sleep -Milliseconds 400
[M]::SetForegroundWindow($h) | Out-Null
Write-Output "$Mode hwnd=$h"
