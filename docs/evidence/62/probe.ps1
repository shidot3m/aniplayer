param(
  [int]$Port = 9224,
  [int]$Samples = 1,
  [int]$EverySec = 10,
  [switch]$ResetCounts,
  [string]$Out = ""
)

# Samples the live media element through WebView2 remote debugging, the way docs/evidence/60 and
# /61 did, plus what a bounded retry policy leaves behind: how many times each playlist and each
# segment URL was fetched. A URL requested twice is a retry the viewer never saw.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port

if ($ResetCounts) {
  Eval-Js "performance.clearResourceTimings(); performance.setResourceTimingBufferSize(100000); 'cleared'" | Out-Null
}

$sample = @'
(() => {
  const v = document.querySelector("video");
  const entries = performance.getEntriesByType("resource").filter(
    (e) => /\.(m3u8|ts)(\?|$)/.test(e.name) || ["xmlhttprequest", "fetch"].includes(e.initiatorType),
  );
  const byUrl = {};
  const origins = {};
  for (const e of entries) {
    const key = e.name.split("?")[0].split("/").slice(-2).join("/");
    byUrl[key] = (byUrl[key] || 0) + 1;
    const o = new URL(e.name).origin;
    origins[o] = (origins[o] || 0) + 1;
  }
  const replays = Object.entries(byUrl).filter(([, n]) => n > 1);
  const buffered = [];
  for (let i = 0; i < v.buffered.length; i++) {
    buffered.push([Math.round(v.buffered.start(i)), Math.round(v.buffered.end(i))]);
  }
  const worker = performance.getEntriesByType("resource")
    .map((e) => e.name)
    .filter((n) => n.includes("hls.worker"));
  const fail = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c";
  return JSON.stringify({
    currentSrc: v.currentSrc.slice(-13),
    readyState: v.readyState,
    networkState: v.networkState,
    currentTime: Math.round(v.currentTime * 10) / 10,
    duration: Math.round(v.duration || 0),
    paused: v.paused,
    frame: v.videoWidth + "x" + v.videoHeight,
    buffered,
    requests: entries.length,
    distinctUrls: Object.keys(byUrl).length,
    replays: replays.length,
    replayDetail: replays.slice(0, 8),
    mediaOrigins: origins,
    worker: worker.length ? worker[0].split("/").pop() : null,
    errorText: (document.body.innerText.match(new RegExp(fail + "[^\\n]*", "g")) || []).join(" / "),
  });
})()
'@

$lines = @()
for ($i = 1; $i -le $Samples; $i++) {
  $value = Eval-Js $sample
  $line = "sample {0} t={1:HH:mm:ss}: {2}" -f $i, (Get-Date), $value
  Write-Output $line
  $lines += $line
  if ($i -lt $Samples) { Start-Sleep -Seconds $EverySec }
}

if ($Out) {
  $lines | Set-Content -Path $Out -Encoding utf8
  Write-Output "wrote $($lines.Count) samples to $Out"
}
Disconnect-Cdp
