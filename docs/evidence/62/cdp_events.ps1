# Shared WebView2 remote-debugging driver for the #62 evidence pass.
# Dot-source it:  . .\cdp_events.ps1 ; Connect-Cdp -Events @("Network") ; Invoke-Cdp ...
# Unlike docs/evidence/61/cdp.ps1 this one keeps the CDP *events* the socket carries: a bounded
# retry policy is only observable through them (what was requested, what answered, what failed).
# A WebSocket forbids two concurrent receives, so there is no timed poll: every message that
# arrives while waiting for a reply is collected, and Pump-Cdp is the cheap command that keeps
# the stream moving when the page would otherwise be quiet.
# Evidence helper, not part of the app. Files stay ASCII — PowerShell 5.1 reads a .ps1 without a
# BOM as ANSI, so Russian text is written as \u escapes inside the page.

$script:cdpSocket = $null
$script:cdpId = 0
$script:cdpBuffer = ""
$script:cdpEvents = New-Object System.Collections.Generic.List[object]
$script:cdpReplies = @{}

function Connect-Cdp([int]$Port = 9224, [string[]]$Events = @()) {
  if ($script:cdpSocket) { return }
  $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list"
  $page = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $page) { throw "no page target on port $Port" }
  $script:cdpSocket = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $script:cdpSocket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()
  Invoke-Cdp "Runtime.enable" @{} | Out-Null
  foreach ($domain in $Events) {
    Invoke-Cdp "$domain.enable" @{} | Out-Null
  }
}

function Disconnect-Cdp {
  if (-not $script:cdpSocket) { return }
  $script:cdpSocket.Dispose()
  $script:cdpSocket = $null
}

function Receive-Message {
  $ct = [System.Threading.CancellationToken]::None
  $buf = New-Object byte[] 8388608
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
  $res = $script:cdpSocket.ReceiveAsync($seg, $ct).Result
  $script:cdpBuffer += [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
  if (-not $res.EndOfMessage) { return }
  $messages = $script:cdpBuffer -split "`n"
  $script:cdpBuffer = ""
  foreach ($message in $messages) {
    if (-not $message.Trim()) { continue }
    $obj = $message | ConvertFrom-Json
    if ($null -ne $obj.id) { $script:cdpReplies[[int]$obj.id] = $obj }
    else { $script:cdpEvents.Add($obj) }
  }
}

function Invoke-Cdp($method, $params) {
  $script:cdpId++
  $id = $script:cdpId
  $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
  $ct = [System.Threading.CancellationToken]::None
  $script:cdpSocket.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  while (-not $script:cdpReplies.ContainsKey($id)) { Receive-Message }
  $reply = $script:cdpReplies[$id]
  $script:cdpReplies.Remove($id)
  return $reply
}

# Guarantees the socket moves: one trivial command per pump, so events keep being collected even
# when the page itself has gone quiet.
function Pump-Cdp([int]$Times = 1) {
  for ($i = 0; $i -lt $Times; $i++) { Invoke-Cdp "Runtime.evaluate" @{ expression = "1" } | Out-Null }
}

# Hands back the events collected so far, after pumping the socket $Pump times.
function Take-Events([int]$Pump = 1) {
  Pump-Cdp -Times $Pump
  $found = $script:cdpEvents.ToArray()
  $script:cdpEvents.Clear()
  return $found
}

function Eval-Js($expression) {
  $r = Invoke-Cdp "Runtime.evaluate" @{
    expression    = $expression
    awaitPromise  = $true
    returnByValue = $true
  }
  if ($r.result.exceptionDetails) { throw "page threw: $($r.result.exceptionDetails.text)" }
  return $r.result.result.value
}

# Real input events at CSS pixel coordinates: the same pointer path a user drives.
function Move-MouseTo([double]$x, [double]$y) {
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x; y = $y } | Out-Null
}

function Click-At([double]$x, [double]$y) {
  Move-MouseTo $x $y
  Start-Sleep -Milliseconds 120
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $x; y = $y; button = "left"; clickCount = 1 } | Out-Null
  Invoke-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $x; y = $y; button = "left"; clickCount = 1 } | Out-Null
}

# Clicks the centre of the first element matching a selector; throws when it is not there, so a
# missing control fails the pass instead of silently clicking nothing.
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

# Clicks the first control whose text, aria-label or title is the base64 of a Russian UI string.
# Radix wraps a styled div inside its trigger button, so a title carried by a descendant counts too.
function Click-Text([string]$base64) {
  $rect = Eval-Js @"
(async () => {
  const t = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const wanted = t('$base64').toLowerCase();
  const textOf = (el) => ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' +
    (el.getAttribute('title') || '') + ' ' + (el.querySelector('[title]')?.getAttribute('title') || '')).trim().toLowerCase();
  const all = Array.from(document.querySelectorAll('button, a, [role="button"], [aria-label], [title]'))
    .filter((e) => textOf(e).includes(wanted));
  const el = all.find((e) => ['BUTTON', 'A'].includes(e.tagName)) || all[0];
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  await new Promise((r) => setTimeout(r, 250));
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: textOf(el).slice(0, 60) });
})()
"@
  if (-not $rect) { throw "no control matching $base64" }
  $p = $rect | ConvertFrom-Json
  Click-At $p.x $p.y
  return "clicked '$($p.label)' at ($([Math]::Round($p.x)),$([Math]::Round($p.y)))"
}
