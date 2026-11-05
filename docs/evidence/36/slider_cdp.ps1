# Shared driver for the #36 evidence pass: one place that knows how the live player is read and
# touched, so seek_focus.ps1 and restore_state.ps1 cannot drift apart on what the probe means.
# Evidence helper, not part of the app. Files stay ASCII — PowerShell 5.1 reads a .ps1 without a
# BOM as ANSI, so Russian UI strings arrive as base64 or as \u escapes, and numbers reach the page
# through ConvertTo-Json, which is culture-independent.

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\62\cdp_events.ps1")

$script:rows = New-Object System.Collections.Generic.List[string]
$script:outPath = ""

function Start-Pass([int]$Port, [string]$Out) {
  $script:outPath = $Out
  if (Test-Path $Out) {
    Get-Content -Encoding UTF8 $Out | ForEach-Object { [void]$script:rows.Add($_) }
  }
  Connect-Cdp -Port $Port
}

function End-Pass {
  Disconnect-Cdp
}

function Log($line) {
  [void]$script:rows.Add(("{0:HH:mm:ss} {1}" -f (Get-Date), $line))
  $script:rows | Out-File -FilePath $script:outPath -Encoding utf8
}

# The seek bar and the volume slider are the only range inputs in the player; they are told apart
# by their own step attribute (0.1 s versus 1 %), so no Cyrillic selector is needed here.
$stateJs = @'
(() => {
  const v = document.querySelector("video");
  const ranges = Array.from(document.querySelectorAll('input[type="range"]'));
  const byStep = (s) => ranges.find((r) => r.getAttribute("step") === s) || null;
  const seek = byStep("0.1");
  const vol = byStep("1");
  const a = document.activeElement;
  const codes = document.querySelector('[data-testid="player-timecodes-above-timeline"]');
  const describe = (el) => {
    if (!el) return "none";
    const label = el.getAttribute("aria-label") || "";
    return el.tagName.toLowerCase() + (el.type ? "[" + el.type + "]" : "") + (label ? " " + label : "");
  };
  return JSON.stringify({
    hasVideo: !!v,
    t: v ? Math.round(v.currentTime * 100) / 100 : null,
    duration: v ? Math.round(v.duration || 0) : null,
    readyState: v ? v.readyState : null,
    paused: v ? v.paused : null,
    seekValue: seek ? Number(seek.value) : null,
    volumeValue: vol ? Number(vol.value) : null,
    active: describe(a),
    timecodes: codes ? codes.innerText.replace(/\n/g, " ") : ""
  });
})()
'@

function State { return (Eval-Js $stateJs) | ConvertFrom-Json }

# Reads the page and writes one row. The caller keeps the returned object, so a delta is always
# computed between two snapshots that already exist.
function Snap([string]$label) {
  $s = State
  Log ("{0} t={1} dur={2} ready={3} paused={4} seekValue={5} volume={6} focus={7} label='{8}'" -f `
    $label, $s.t, $s.duration, $s.readyState, $s.paused, $s.seekValue, $s.volumeValue, $s.active, $s.timecodes)
  return $s
}

function Delta($before, $after) { return [Math]::Round($after.t - $before.t, 2) }
function Volume-Delta($before, $after) { return [Math]::Round($after.volumeValue - $before.volumeValue, 2) }

# Real key events, so the browser's own default action for a focused range input is in play: the
# fix has to cancel it with preventDefault, not just run the hotkey as well.
function Press-Key([string]$Code, [int]$Vk, [int]$Modifiers = 0) {
  $common = @{ code = $Code; key = $Code; windowsVirtualKeyCode = $Vk; nativeVirtualKeyCode = $Vk; modifiers = $Modifiers }
  Invoke-Cdp "Input.dispatchKeyEvent" ($common + @{ type = "keyDown" }) | Out-Null
  Invoke-Cdp "Input.dispatchKeyEvent" ($common + @{ type = "keyUp" }) | Out-Null
}

# A point on the track of the range input with the given step, $Fraction of its width in.
function Track-Point([string]$Step, [double]$Fraction) {
  $literal = ConvertTo-Json $Step
  $clamp = ConvertTo-Json ([Math]::Max(0.002, [Math]::Min(0.998, $Fraction)))
  $rect = Eval-Js @"
(() => {
  const el = Array.from(document.querySelectorAll('input[type="range"]')).find((r) => r.getAttribute("step") === $literal);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width * $clamp, y: r.y + r.height / 2 });
})()
"@
  if (-not $rect) { throw "no range input with step $Step" }
  return $rect | ConvertFrom-Json
}

# Presses at one point of a track, drags across it, releases: the pointer path a user takes when
# dragging the seek bar rather than clicking it.
function Drag-Track([string]$Step, [double]$FromFraction, [double]$ToFraction) {
  $from = Track-Point $Step $FromFraction
  $to = Track-Point $Step $ToFraction
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $from.x; y = $from.y } | Out-Null
  Start-Sleep -Milliseconds 120
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $from.x; y = $from.y; button = "left"; clickCount = 1 } | Out-Null
  for ($i = 1; $i -le 5; $i++) {
    $x = $from.x + ($to.x - $from.x) * ($i / 5)
    Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x; y = $from.y; buttons = 1 } | Out-Null
    Start-Sleep -Milliseconds 60
  }
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $to.x; y = $to.y; button = "left" } | Out-Null
  return "dragged step=$Step from=$FromFraction to=$ToFraction"
}

# Clicks a point of a track, which is what leaves focus on the range input in issue #36.
function Click-Track([string]$Step, [double]$Fraction) {
  $p = Track-Point $Step $Fraction
  Click-At $p.x $p.y
  return "clicked step=$Step at=$Fraction"
}
