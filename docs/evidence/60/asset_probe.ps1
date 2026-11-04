param(
  [string]$PlaylistPath = ""
)

$ErrorActionPreference = "Stop"
# Ask the running webview, over WebView2's remote debugging port, what the asset protocol
# answers for the URL shapes that matter: one percent-encoded segment for the whole path (what
# convertFileSrc produces), one segment per directory (what playback::asset_url produces), the
# segment resolved beside that folder, and the segment resolved at the origin root.
$root = (Get-Location).Path
$exe = Join-Path $root "dist_portable\aniplayer.exe"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9223"
Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe)
Start-Sleep -Seconds 10

$targets = Invoke-RestMethod -Uri "http://127.0.0.1:9223/json/list"
$page = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
if (-not $page) { throw "no page target; found: $($targets.type -join ',')" }
"target: $($page.url)"

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()

function Invoke-Cdp($id, $method, $params) {
  $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf = New-Object byte[] 262144
  while ($true) {
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $obj = $text | ConvertFrom-Json
    if ($obj.id -eq $id) { return $obj }
  }
}

$script:nextId = 2
function Probe($label, $urls) {
  $list = ($urls | ConvertTo-Json -Compress)
  if ($urls.Count -eq 1) { $list = "[$list]" }
  $js = "(async () => { const out = []; for (const url of $list) { try { const res = await fetch(url); const head = (await res.text()).slice(0, 44); out.push(res.status + ' ' + url.slice(24, 70) + ' :: ' + head.replace(/\n/g, '|')); } catch (e) { out.push('THROW ' + e.name + ': ' + e.message + ' for ' + url.slice(24, 70)); } } return out.join(' ;; '); })()"
  $r = Invoke-Cdp $script:nextId "Runtime.evaluate" @{ expression = $js; awaitPromise = $true; returnByValue = $true }
  $script:nextId++
  $value = $r.result.result.value
  if ($null -eq $value) { $value = ($r | ConvertTo-Json -Depth 8 -Compress) }
  "{0}: {1}" -f $label, $value
}

$playlist = "E:\coding\aniplayer\dist_portable\downloads\10337\1\index.m3u8"
$single = "http://asset.localhost/" + [uri]::EscapeDataString($playlist)
$perDir = "http://asset.localhost/" + ((($playlist -split '[\\/]') | ForEach-Object { [uri]::EscapeDataString($_) }) -join "/")
$segmentBeside = $perDir -replace "index\.m3u8$", "segment-00000.ts"
$segmentAtRoot = "http://asset.localhost/segment-00000.ts"

Invoke-Cdp 1 "Runtime.enable" @{} | Out-Null
Probe "playlist, whole path in one segment" @($single)
Probe "playlist, one segment per directory" @($perDir)
Probe "segment beside the folder" @($segmentBeside)
Probe "segment at the origin root" @($segmentAtRoot)

$ws.Dispose()
