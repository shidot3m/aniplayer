# Shared WebView2 remote-debugging driver for the #61 evidence pass.
# Dot-source it:  . .\cdp.ps1 ; Connect-Cdp ; Eval-Js "1+1"
# Not part of the app — an evidence helper, like docs/evidence/60/win32.ps1.

$script:cdpSocket = $null
$script:cdpId = 0

function Connect-Cdp([int]$Port = 9224) {
  if ($script:cdpSocket) { return }
  $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list"
  $page = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $page) { throw "no page target on port $Port" }
  $script:cdpSocket = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $script:cdpSocket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()
  Invoke-Cdp "Runtime.enable" @{} | Out-Null
}

function Invoke-Cdp($method, $params) {
  $ct = [System.Threading.CancellationToken]::None
  $script:cdpId++
  $payload = @{ id = $script:cdpId; method = $method; params = $params } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
  $script:cdpSocket.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf = New-Object byte[] 1048576
  while ($true) {
    $recv = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
    $res = $script:cdpSocket.ReceiveAsync($recv, $ct).Result
    $obj = ([System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)) | ConvertFrom-Json
    if ($obj.id -eq $script:cdpId) { return $obj }
  }
}

function Eval-Js($expression) {
  $r = Invoke-Cdp "Runtime.evaluate" @{
    expression   = $expression
    awaitPromise = $true
    returnByValue = $true
  }
  if ($r.result.exceptionDetails) { throw "page threw: $($r.result.exceptionDetails.text)" }
  return $r.result.result.value
}

# Real input events at CSS pixel coordinates, i.e. the same pointer path a user drives.
function Move-MouseTo([double]$x, [double]$y) {
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x; y = $y } | Out-Null
}

function Click-At([double]$x, [double]$y) {
  Move-MouseTo $x $y
  Start-Sleep -Milliseconds 120
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $x; y = $y; button = "left"; clickCount = 1 } | Out-Null
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $x; y = $y; button = "left"; clickCount = 1 } | Out-Null
}

# Clicks the centre of the first element matching a selector; throws when it is not there,
# so a missing control fails the pass instead of silently clicking nothing.
function Click-Element([string]$selector) {
  $literal = ConvertTo-Json $selector
  $rect = Eval-Js @"
(async () => {
  const el = document.querySelector($literal);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  await new Promise((r) => setTimeout(r, 250));
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()
"@
  if (-not $rect) { throw "no element for selector $selector" }
  $p = $rect | ConvertFrom-Json
  Click-At $p.x $p.y
  return "clicked $selector at ($([Math]::Round($p.x)),$([Math]::Round($p.y)))"
}
