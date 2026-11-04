param(
  [int]$Port = 9224,
  [string]$Find = "",
  [string]$Selector = "",
  [double]$X = 0,
  [double]$Y = 0,
  [switch]$Wake
)

# Drives the live app with real input events through WebView2 remote debugging.
# -Find takes base64 of a Russian UI string (so this file stays ASCII), -Selector an element
# selector, -X/-Y a point in the window. Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($Wake) {
  Move-MouseTo 400 300
  Write-Output "moved the pointer into the window"
} elseif ($Find) {
  Click-Text $Find
} elseif ($Selector) {
  Click-Element $Selector
} else {
  Click-At $X $Y
  Write-Output "clicked ($X,$Y)"
}
Disconnect-Cdp
