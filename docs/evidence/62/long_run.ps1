param(
  [int]$Port = 9224,
  [int]$Minutes = 27,
  [int]$EverySec = 20,
  [string]$Out = "long-run.txt",
  [string]$Console = "console-log.txt"
)

# Watches the player run unattended for a full Episode and the start of the next one: the
# playhead, the episode the overlay says it is on, and how often each playlist and segment was
# fetched. Anything that reaches the page console is written next to it. Nothing here touches the
# player — the point of the pass is that it needs nothing.
# Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port -Events @("Network", "Log")

Eval-Js "performance.clearResourceTimings(); performance.setResourceTimingBufferSize(100000); 'ok'" | Out-Null
Invoke-Cdp "Log.enable" @{} | Out-Null

$sample = @'
(() => {
  const v = document.querySelector("video");
  const media = performance.getEntriesByType("resource").filter(
    (e) => /\.(m3u8|ts)(\?|$)/.test(e.name),
  );
  const byUrl = {};
  for (const e of media) {
    const key = e.name.split("?")[0].split("/").pop();
    byUrl[key] = (byUrl[key] || 0) + 1;
  }
  const replays = Object.entries(byUrl).filter(([, n]) => n > 1);
  const header = document.body.innerText.split("\n").slice(0, 6).join(" | ");
  return JSON.stringify({
    at: new Date().toLocaleTimeString(),
    episode: header,
    t: Math.round(v.currentTime * 10) / 10,
    duration: Math.round(v.duration || 0),
    readyState: v.readyState,
    paused: v.paused,
    bufferEnd: v.buffered.length ? Math.round(v.buffered.end(v.buffered.length - 1)) : 0,
    segments: media.length,
    distinct: Object.keys(byUrl).length,
    replays: replays.length,
    replayDetail: replays.slice(0, 6),
  });
})()
'@

$rows = New-Object System.Collections.Generic.List[string]
$consoleRows = New-Object System.Collections.Generic.List[string]

# The event's own timestamp, not the moment of reading: Log.enable replays whatever the browser had
# buffered, so wall-clock-of-capture would smear old entries onto the first sample.
function EventTime($epochMs) {
  if ($null -eq $epochMs) { return (Get-Date).ToString("HH:mm:ss") }
  return [DateTimeOffset]::FromUnixTimeMilliseconds([long]$epochMs).ToLocalTime().ToString("HH:mm:ss")
}
$ended = (Get-Date).AddMinutes($Minutes)
while ((Get-Date) -lt $ended) {
  Start-Sleep -Seconds $EverySec
  foreach ($event in Take-Events -Pump 1) {
    if ($event.method -eq "Runtime.consoleAPICalled") {
      $text = ($event.params.args | ForEach-Object { $_.value }) -join " "
      $consoleRows.Add(("{0} console {1} {2}" -f (EventTime $event.params.timestamp), $event.params.type, $text))
    }
    elseif ($event.method -eq "Log.entryAdded") {
      $e = $event.params.entry
      $consoleRows.Add(("{0} {1} {2} :: {3}" -f (EventTime $e.timestamp), $e.level, $e.source, $e.text))
    }
    elseif ($event.method -eq "Runtime.exceptionThrown") {
      $d = $event.params.exceptionDetails
      $consoleRows.Add(("{0} exception {1}" -f (EventTime $d.timestamp), $d.exception.description))
    }
  }
  $line = Eval-Js $sample
  $rows.Add(("{0:HH:mm:ss} {1}" -f (Get-Date), $line))
  $rows | Out-File -FilePath $Out -Encoding utf8
  $consoleRows | Out-File -FilePath $Console -Encoding utf8
}

$rows | ForEach-Object { $_ } | Select-Object -Last 3
Disconnect-Cdp
