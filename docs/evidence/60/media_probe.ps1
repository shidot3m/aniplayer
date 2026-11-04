$ErrorActionPreference = "Stop"
# Reads the live media element through WebView2's remote debugging port: the URL the element
# actually plays, whether the position advances, and which origins the page's own resource
# timings attribute the media to.
$targets = Invoke-RestMethod -Uri "http://127.0.0.1:9224/json/list"
$page = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
if (-not $page) { throw "no page target" }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()

$script:id = 0
function Invoke-Cdp($method, $params) {
  $script:id++
  $payload = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf = New-Object byte[] 524288
  while ($true) {
    $recv = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recv, $ct).Result
    $obj = ([System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)) | ConvertFrom-Json
    if ($obj.id -eq $script:id) { return $obj }
  }
}

function Ask($label, $js) {
  $r = Invoke-Cdp "Runtime.evaluate" @{ expression = $js; awaitPromise = $true; returnByValue = $true }
  $v = $r.result.result.value
  if ($null -eq $v) { $v = ($r | ConvertTo-Json -Depth 8 -Compress) }
  "{0}: {1}" -f $label, $v
}

$media = @'
(() => {
  const v = document.querySelector("video");
  const media = performance.getEntriesByType("resource")
    .filter((e) => /\.(m3u8|ts)(\?|$)/.test(e.name) || e.initiatorType === "xmlhttprequest")
    .map((e) => new URL(e.name).origin);
  const counts = {};
  for (const o of media) counts[o] = (counts[o] || 0) + 1;
  return JSON.stringify({
    currentSrc: v.currentSrc,
    readyState: v.readyState,
    currentTime: Math.round(v.currentTime * 10) / 10,
    paused: v.paused,
    muted: v.muted,
    volume: v.volume,
    audioTracks: v.audioTracks ? v.audioTracks.length : null,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight,
    mediaOrigins: counts,
  });
})()
'@

Invoke-Cdp "Runtime.enable" @{} | Out-Null
Ask "sample 1" $media
Start-Sleep -Seconds 8
Ask "sample 2 (8 s later)" $media
$ws.Dispose()
