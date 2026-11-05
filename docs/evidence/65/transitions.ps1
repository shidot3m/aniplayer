param(
  [int]$Port = 9224,
  [int]$LongRunMinutes = 12,
  [int]$EverySec = 20,
  [string]$Out = "transitions.txt",
  [string]$Console = "console.txt"
)

# Drives the three transitions #65 names (first frame of an Episode, Quality switch, autoplay to
# the next Episode) and then leaves the player running unattended, while every page-console entry
# and uncaught exception is written with the event's own timestamp. The point of the pass is the
# absence of OperationError copyExternalImageToTexture rows inside the run window.
# Evidence helper for #65, not part of the app. Files stay ASCII: PowerShell 5.1 reads a .ps1
# without a BOM as ANSI, so Russian text is written as \u escapes inside the page.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\62\cdp_events.ps1")
Connect-Cdp -Port $Port -Events @("Log")

$script:startEpoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$rows = New-Object System.Collections.Generic.List[string]
$consoleRows = New-Object System.Collections.Generic.List[string]
$runConsole = New-Object System.Collections.Generic.List[string]

# The event's own timestamp, not the moment of reading: Log.enable replays whatever the browser had
# buffered, so wall-clock-of-capture would smear old entries onto the first sample.
function EventTime($epochMs) {
  if ($null -eq $epochMs) { return (Get-Date).ToString("HH:mm:ss") }
  return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$epochMs).ToLocalTime().ToString("HH:mm:ss")
}

function Drain {
  foreach ($event in Take-Events -Pump 1) {
    $epoch = $null
    $line = $null
    if ($event.method -eq "Runtime.consoleAPICalled") {
      $epoch = $event.params.timestamp
      $text = ($event.params.args | ForEach-Object { $_.value }) -join " "
      $line = ("{0} console {1} {2}" -f (EventTime $epoch), $event.params.type, $text)
    }
    elseif ($event.method -eq "Log.entryAdded") {
      $e = $event.params.entry
      $epoch = $e.timestamp
      $line = ("{0} {1} {2} :: {3}" -f (EventTime $epoch), $e.level, $e.source, $e.text)
    }
    elseif ($event.method -eq "Runtime.exceptionThrown") {
      $d = $event.params.exceptionDetails
      $epoch = $d.timestamp
      $desc = if ($d.exception) { $d.exception.description } else { $d.text }
      $line = ("{0} exception {1}" -f (EventTime $epoch), $desc)
    }
    if ($line) {
      $consoleRows.Add($line)
      if ($null -eq $epoch -or [long]$epoch -ge $script:startEpoch) { $runConsole.Add($line) }
    }
  }
  if ($consoleRows.Count -gt 0) { $consoleRows | Out-File -FilePath $Console -Encoding utf8 }
}

$stateJs = @'
(() => {
  const v = document.querySelector("video");
  if (!v) return JSON.stringify({ hasVideo: false });
  const c = document.querySelector("canvas");
  const fail = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c";
  const ep = (document.body.innerText.match(/\u042d\u043f\u0438\u0437\u043e\u0434 \d+/) || [""])[0];
  return JSON.stringify({
    episode: ep,
    t: Math.round(v.currentTime * 10) / 10,
    duration: Math.round(v.duration || 0),
    readyState: v.readyState,
    frame: v.videoWidth + "x" + v.videoHeight,
    paused: v.paused,
    canvas: !!c,
    opacity: getComputedStyle(v).opacity,
    fault: document.body.innerText.split("\n").filter((l) => l.includes(fail)).join(" / ")
  });
})()
'@

function State { return (Eval-Js $stateJs) | ConvertFrom-Json }

function Sample($label) {
  $s = State
  $rows.Add(("{0:HH:mm:ss} {1} ep={2} t={3} duration={4} readyState={5} frame={6} paused={7} canvas={8} opacity={9} fault={10}" -f (Get-Date), $label, $s.episode, $s.t, $s.duration, $s.readyState, $s.frame, $s.paused, $s.canvas, $s.opacity, $s.fault))
  $rows | Out-File -FilePath $Out -Encoding utf8
}

function Watch($label, $seconds, $interval = 2) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) {
    Start-Sleep -Seconds $interval
    Drain
    Sample $label
  }
}

function Wait-Until([scriptblock]$check, $seconds = 60) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) {
    Start-Sleep -Seconds 1
    Drain
    if (& $check) { return $true }
  }
  return $false
}

function Menu-Open {
  $raw = Eval-Js '(() => { const want = "1080p"; return !!Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === want); })()'
  return [bool]$raw
}

function Open-Menu {
  if (Menu-Open) { return }
  Click-Text "0J3QsNGB0YLRgNC+0LnQutC4INC/0LvQtdC10YDQsA==" | Out-Null
  Start-Sleep -Milliseconds 700
  Drain
  if (-not (Menu-Open)) { throw "the player menu did not open" }
}

function Pick-Quality([string]$base64, [string]$frame, [int]$seconds = 60) {
  Open-Menu
  Click-Text $base64 | Out-Null
  $ok = Wait-Until { (State).frame -eq $frame -and (State).readyState -ge 2 } $seconds
  Drain
  Sample ("quality-" + $frame)
  return $ok
}

Drain
Sample "baseline"

# 1. First frame of an Episode: the Episode list reattaches the media, so the renderer loop is
# already running while the element still has no frame of the new source.
$current = (State).episode
$currentNumber = [int]([regex]::Match($current, "\d+").Value)
$nextNumber = if ($currentNumber -lt 6) { $currentNumber + 1 } else { $currentNumber - 1 }
$nextLabel = [string]::new([char[]]@(0x42D, 0x43F, 0x438, 0x437, 0x43E, 0x434, 0x20)) + [string]$nextNumber
$nextBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($nextLabel))
$rows.Add(("{0:HH:mm:ss} episode-switch from={1} to={2}" -f (Get-Date), $current, $nextLabel))
$listOpen = Eval-Js 'document.body.innerText.includes("\u0412\u0441\u0435\u0433\u043e:")'
if (-not $listOpen) {
  Click-Text "0KHQv9C40YHQvtC6INGN0L/QuNC30L7QtNC+0LI=" | Out-Null
  Start-Sleep -Milliseconds 900
  Drain
}
Click-Text $nextBase64 | Out-Null
Watch "episode-start" 24 2

# 2. Quality switch under the running renderer, away from the starting tier and back.
$startFrame = (State).frame
if ($startFrame -eq "1920x1080") {
  $awayBase64 = "NzIwcA=="; $awayFrame = "1280x720"
  $backBase64 = "MTA4MHA="; $backFrame = "1920x1080"
} else {
  $awayBase64 = "MTA4MHA="; $awayFrame = "1920x1080"
  $backBase64 = "NzIwcA=="; $backFrame = "1280x720"
}
$away = Pick-Quality $awayBase64 $awayFrame 90
$rows.Add(("{0:HH:mm:ss} quality-{1} reached={2}" -f (Get-Date), $awayFrame, $away))
$rows | Out-File -FilePath $Out -Encoding utf8
$back = Pick-Quality $backBase64 $backFrame 90
$rows.Add(("{0:HH:mm:ss} quality-{1} reached={2}" -f (Get-Date), $backFrame, $back))
$rows | Out-File -FilePath $Out -Encoding utf8

# 3. Autoplay to the next Episode: jump to the tail, let the store's own rule take over.
$before = (State).episode
Eval-Js '(() => { const v = document.querySelector("video"); v.currentTime = Math.max(0, v.duration - 4); return String(v.currentTime); })()' | Out-Null
$advanced = Wait-Until { $s = State; $s.episode -ne $before -and $s.readyState -ge 2 } 90
$rows.Add(("{0:HH:mm:ss} autoplay from={1} reached={2}" -f (Get-Date), $before, $advanced))
$rows | Out-File -FilePath $Out -Encoding utf8
Watch "autoadvance" 20 2

# 4. Long run: nothing touches the player, the console keeps being collected.
$ended = (Get-Date).AddMinutes($LongRunMinutes)
while ((Get-Date) -lt $ended) {
  Start-Sleep -Seconds $EverySec
  Drain
  Sample "long-run"
}

Drain
$summary = $runConsole | Where-Object { $_ -match "OperationError|CopyExternalImageToTexture|GPUQueue|renderFrame" }
$summary | Out-File -FilePath "console-gpu.txt" -Encoding utf8
"GPU-copy rows inside the run window: $($summary.Count)" | Out-File -FilePath "console-summary.txt" -Encoding utf8
Drain
Disconnect-Cdp
Write-Output ("console rows: {0}; run window: {1}; gpu rows in run: {2}" -f $consoleRows.Count, $runConsole.Count, $summary.Count)
