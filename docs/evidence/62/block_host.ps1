param(
  [int]$Port = 9224,
  [string]$Pattern = "*cache-ru2*",
  [string]$Reason = "ConnectionRefused",
  [int]$Seconds = 40,
  [int]$SampleEverySec = 2,
  [switch]$TryControls,
  [string]$Log = "",
  [string]$Out = "block.txt"
)

# Makes one CDN host unreachable for a window while the player keeps running: every request the
# browser makes for that host is failed (or timed out) before it leaves the machine, which is the
# #45 symptom replayed on the WebView stack. Logs the playhead, the buffer and the counters, and
# optionally drives the pause/play control from inside the window to prove the UI still answers.
# Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port -Events @("Network", "Fetch")

Invoke-Cdp "Fetch.enable" @{
  patterns = @(@{ urlPattern = $Pattern; requestStage = "Request" })
} | Out-Null

$sample = @'
(() => {
  const v = document.querySelector("video");
  const buffered = v.buffered.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0;
  return JSON.stringify({
    t: Math.round(v.currentTime * 10) / 10,
    ready: v.readyState,
    paused: v.paused,
    bufferEnd: buffered,
    stalled: v.seekable.length ? Math.round(v.seekable.end(v.seekable.length - 1)) : 0,
  });
})()
'@

$rows = New-Object System.Collections.Generic.List[string]
$started = Get-Date
$blocked = 0
$failed = 0
$ok = 0
$controls = ""

function Stamp { ((Get-Date) - $started).TotalSeconds }

# The segment number a URL names: the only way to see, from outside, whether the walk moved on.
function Split-Segment($url) {
  if ($url -match "_(\d+)\.ts") { return $Matches[1] }
  if ($url -match "\.m3u8") { return "playlist" }
  return "other"
}

while ((Stamp) -lt $Seconds) {
  Start-Sleep -Seconds $SampleEverySec
  foreach ($event in Take-Events -Pump 1) {
    $p = $event.params
    if ($event.method -eq "Fetch.requestPaused") {
      $blocked++
      Invoke-Cdp "Fetch.failRequest" @{ requestId = $p.requestId; errorReason = $Reason } | Out-Null
      $rows.Add(("{0,6:0}s BLOCK  seg-{1}  {2}" -f (Stamp), (Split-Segment $p.request.url), $p.request.url))
    }
    elseif ($event.method -eq "Runtime.consoleAPICalled" -and $Log) {
      $text = ($p.args | ForEach-Object { $_.value }) -join " "
      if ($text -match $Log) { $rows.Add(("{0,6:0}s PAGE   {1}" -f (Stamp), $text)) }
    }
    elseif ($event.method -eq "Network.loadingFailed") { $failed++; $rows.Add(("{0,6:0}s FAIL   seg-{1} '{2}'" -f (Stamp), (Split-Segment $p.request.url), $p.errorText)) }
    elseif ($event.method -eq "Network.responseReceived" -and $p.response.url -notmatch "ipc.localhost") {
      $ok++
      $rows.Add(("{0,6:0}s RESP   [{1}] seg-{2} {3}" -f (Stamp), $p.response.status, (Split-Segment $p.response.url), $p.response.url))
    }
  }

  $state = (Eval-Js $sample) | ConvertFrom-Json
  $rows.Add(("{0,6:0}s PLAY   currentTime={1} readyState={2} paused={3} bufferEnd={4} blocked={5} failed={6} answered={7}" -f (Stamp), $state.t, $state.ready, $state.paused, $state.bufferEnd, $blocked, $failed, $ok))

  if ($TryControls -and -not $controls -and (Stamp) -gt 8) {
    Click-Element '[data-testid="player-play-pause-btn"]' | Out-Null
    Start-Sleep -Seconds 2
    $paused = (Eval-Js $sample | ConvertFrom-Json).paused
    Click-Element '[data-testid="player-play-pause-btn"]' | Out-Null
    Start-Sleep -Seconds 2
    $resumed = (Eval-Js $sample | ConvertFrom-Json).paused
    $controls = "pause click -> paused=$paused, second click -> paused=$resumed"
    $rows.Add(("{0,6:0}s CLICK  {1}" -f (Stamp), $controls))
  }
}

Invoke-Cdp "Fetch.disable" @{} | Out-Null
# After the interception stops, the playhead is what says whether the session recovered on its own.
for ($i = 1; $i -le 6; $i++) {
  $state = (Eval-Js $sample) | ConvertFrom-Json
  $rows.Add(("+{0}s AFTER  currentTime={1} readyState={2} paused={3} bufferEnd={4}" -f $i, $state.t, $state.ready, $state.paused, $state.bufferEnd))
  Start-Sleep -Seconds 2
}

"pattern=$Pattern reason=$Reason blocked=$blocked failed=$failed answered=$ok"
if ($controls) { "controls: $controls" }
$rows | Out-File -FilePath $Out -Encoding utf8
$rows | ForEach-Object { $_ } | Select-Object -Last 24
Disconnect-Cdp
