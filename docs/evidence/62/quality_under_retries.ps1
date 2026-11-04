param(
  [int]$Port = 9224,
  [string]$Pattern = "*cache1.cache-ru*",
  [int]$Seconds = 90,
  [string]$Out = "quality.txt"
)

# Switches Quality from 1080p down to 720p while the CDN is being failed left and right: the #50
# symptom (a Quality switch that errored or left a black frame) replayed on purpose at the worst
# moment, with retries in flight. Real input events drive the menu, so it is the user's path.
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
  const fail = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c";
  return JSON.stringify({
    t: Math.round(v.currentTime * 10) / 10,
    frame: v.videoWidth + "x" + v.videoHeight,
    readyState: v.readyState,
    paused: v.paused,
    bufferEnd: v.buffered.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
    fault: document.body.innerText.split("\n").filter((l) => l.includes(fail)).join(" / "),
  });
})()
'@

$rows = New-Object System.Collections.Generic.List[string]
$started = Get-Date
$script:blocked = 0
function Stamp { ((Get-Date) - $started).TotalSeconds }

function Drain {
  foreach ($event in Take-Events -Pump 1) {
    if ($event.method -eq "Fetch.requestPaused") {
      $script:blocked++
      Invoke-Cdp "Fetch.failRequest" @{ requestId = $event.params.requestId; errorReason = "ConnectionRefused" } | Out-Null
    }
  }
}

function Note($label) {
  $rows.Add(("{0,6:0}s {1} {2}" -f (Stamp), $label, (Eval-Js $sample)))
}

Move-MouseTo 500 400
Note "before"

for ($i = 1; (Stamp) -lt $Seconds; $i++) {
  Start-Sleep -Seconds 1
  Drain
  if ((Stamp) -gt 12 -and $i % 8 -eq 0) {
    $target = if ($i -lt 40) { "MTA4MHA=" } else { "NzIwcA==" }
    # Radix needs the menu open before its items exist; a click that landed while the list was
    # still animating is retried rather than swallowed.
    for ($try = 1; $try -le 2; $try++) {
      Click-Text "0J3QsNGB0YLRgNC+0LnQutC4INC/0LvQtdC10YDQsA==" | Out-Null
      Drain
      Start-Sleep -Milliseconds 600
      Drain
      try {
        Click-Text $target | Out-Null
        break
      } catch {
        $rows.Add(("{0,6:0}s RETRY  attempt {1} did not find the quality control" -f (Stamp), $try))
      }
    }
    Drain
    Start-Sleep -Seconds 3
    Drain
    Note "quality-switch"
  }
  if ($i % 5 -eq 0) { Note "play" }
}

Invoke-Cdp "Fetch.disable" @{} | Out-Null
for ($i = 1; $i -le 8; $i++) { Start-Sleep -Seconds 2; Drain; Note "after" }

$rows | Out-File -FilePath $Out -Encoding utf8
"blocked=$($script:blocked)"
$rows | ForEach-Object { $_ } | Select-Object -First 4
$rows | ForEach-Object { $_ } | Select-Object -Last 4
Disconnect-Cdp
