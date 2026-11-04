param(
  [int]$Port = 9224,
  [string]$Selector = "",
  [string]$Find = "",
  [string]$Press = "",
  [int]$Modifiers = 0,
  [double]$X = 0,
  [double]$Y = 0,
  [switch]$Wake
)

# Drives the live app through real input events: a bare pointer move (the overlay counts
# pointermove to show its controls), a key press, a point in the window, the centre of an
# element found by selector, or the first button/anchor matching a JS predicate (-Find).
# Inside a predicate, t('<base64>') decodes a Russian UI string, so this file stays ASCII.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

if ($Wake) {
  Move-MouseTo 400 300
  Write-Output "moved the pointer into the window"
  exit 0
}

if ($Press) {
  Invoke-Cdp "Input.dispatchKeyEvent" @{ type = "keyDown"; code = $Press; key = $Press; modifiers = $Modifiers } | Out-Null
  Invoke-Cdp "Input.dispatchKeyEvent" @{ type = "keyUp"; code = $Press; key = $Press; modifiers = $Modifiers } | Out-Null
  Write-Output "pressed $Press (modifiers $Modifiers)"
  exit 0
}

if ($Find) {
  $rect = Eval-Js @"
(async () => {
  const t = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const match = (el) => $Find;
  const el = Array.from(document.querySelectorAll('button, a, [title], [role="switch"]')).find(match);
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 300));
  const q = el.getBoundingClientRect();
  return JSON.stringify({ x: q.x + q.width / 2, y: q.y + q.height / 2, label: (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 40) });
})()
"@
  if (-not $rect) { throw "nothing matched the predicate" }
  $p = $rect | ConvertFrom-Json
  Click-At $p.x $p.y
  Write-Output "clicked '$($p.label)' at ($([Math]::Round($p.x)),$([Math]::Round($p.y)))"
  exit 0
}

if ($Selector) {
  Write-Output (Click-Element $Selector)
  exit 0
}

Click-At $X $Y
Write-Output "clicked at ($X,$Y)"
