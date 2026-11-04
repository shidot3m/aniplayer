param(
  [int]$Port = 9224,
  [int]$Seconds = 60,
  [int]$EverySec = 2,
  [string]$Out = "netlog.txt"
)

# Records what the live webview actually puts on the wire: every request, its status, its
# redirect chain and its failures. This is how a rotating CDN host and a bounded retry become
# observable — the app shows nothing, the socket shows everything.
# Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port -Events @("Network")

$started = Get-Date
$rows = New-Object System.Collections.Generic.List[string]
$hosts = @{}
$seen = @{}

function Add-Row($line) {
  $rows.Add($line) | Out-Null
}

while (((Get-Date) - $started).TotalSeconds -lt $Seconds) {
  Start-Sleep -Seconds $EverySec
  foreach ($event in Take-Events -Pump 1) {
    $p = $event.params
    switch ($event.method) {
      "Network.requestWillBeSent" {
        $url = $p.request.url
        if ($p.redirectResponse) {
          $from = $p.request.url
          Add-Row ("{0,6:0}s REDIR  -> {1} [{2}] Location={3}" -f ((Get-Date) - $started).TotalSeconds, $url, $p.redirectResponse.status, $p.redirectResponse.headers.location)
        } else {
          Add-Row ("{0,6:0}s REQ    {1}" -f ((Get-Date) - $started).TotalSeconds, $url)
        }
        $h = ([Uri]$url).Host
        if (-not $seen.ContainsKey($url)) { $seen[$url] = $true } else { $seen[$url] = $seen[$url] + 1 }
        if ($h) { $hosts[$h] = 1 + ([int]$hosts[$h]) }
      }
      "Network.responseReceived" {
        Add-Row ("{0,6:0}s RESP   {1} [{2}]" -f ((Get-Date) - $started).TotalSeconds, $p.response.url, $p.response.status)
      }
      "Network.loadingFailed" {
        Add-Row ("{0,6:0}s FAIL   {1} errorText='{2}' blocked={3}" -f ((Get-Date) - $started).TotalSeconds, $p.requestId, $p.errorText, $p.blockedReason)
      }
    }
  }
}

$repeated = $seen.GetEnumerator() | Where-Object { $_.Value -gt 1 } | Sort-Object -Property Value -Descending

"--- requests by host ---"
$hosts.GetEnumerator() | Sort-Object -Property Value -Descending | ForEach-Object { "{0,5}  {1}" -f $_.Value, $_.Key }
"--- urls fetched more than once (a retry the viewer never saw) ---"
foreach ($r in $repeated) { "{0,3}x  {1}" -f $r.Value, $r.Key }
"--- wire log ---"
$rows | ForEach-Object { $_ }
$rows | Out-File -FilePath $Out -Encoding utf8
Disconnect-Cdp
