param(
  [int]$Port = 9224,
  [string]$Out = "texttrack-01.txt",
  [int]$Samples = 2,
  [int]$EverySec = 25,
  [switch]$AlreadyPlaying,
  [string]$OpenAria = ""
)

# Asks the live media element, through WebView2 remote debugging, which text tracks the running
# stream produced: the TextTrackList, any <track> node hls.js appended, and how much media the
# page really fetched. The byte-level answer is cea608_probe.py; this is the same question put to
# the stack a viewer actually runs, on a real Episode.
# Evidence helper for #64, not part of the app. ASCII only: PowerShell 5.1 reads a BOM-less .ps1
# as ANSI, so Russian UI strings travel as base64.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\62\cdp_events.ps1")
Connect-Cdp -Port $Port

$OPEN_PREFIX = "0J7RgtC60YDRi9GC"                    # "Открыт"
$PLAY_PREFIX = "0JLQvtGB0L/RgNC+0LjQt9Cy0LXRgdGC0Lgg0Y3Qv9C40LfQvtC0"  # "Воспроизвести эпизод"

function Center-Of-Prefix([string]$b64) {
  $rect = Eval-Js @"
(() => {
  const t = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
  const wanted = t('$b64');
  const el = Array.from(document.querySelectorAll('[aria-label]'))
    .find((e) => (e.getAttribute('aria-label') || '').startsWith(wanted));
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: el.getAttribute('aria-label') });
})()
"@
  if (-not $rect) { throw "no control whose aria-label starts with $b64" }
  $rect | ConvertFrom-Json
}

function Center-Of-Exact([string]$b64) {
  $rect = Eval-Js @"
(() => {
  const t = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
  const wanted = t('$b64');
  const el = Array.from(document.querySelectorAll('[aria-label]'))
    .find((e) => (e.getAttribute('aria-label') || '') === wanted);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: el.getAttribute('aria-label') });
})()
"@
  if (-not $rect) { throw "no control with aria-label $b64" }
  $rect | ConvertFrom-Json
}

function Get-Sample {
  Eval-Js @'
(() => {
  const v = document.querySelector("video");
  if (!v) return null;
  const tracks = Array.from(v.textTracks).map((t) => ({
    kind: t.kind, label: t.label, language: t.language, mode: t.mode, cues: t.cues ? t.cues.length : null,
  }));
  const nodes = Array.from(v.querySelectorAll("track")).map((n) => ({
    kind: n.kind, label: n.label, src: (n.getAttribute("src") || "").slice(0, 40),
  }));
  const resources = performance.getEntriesByType("resource");
  return JSON.stringify({
    currentSrc: (v.currentSrc || "").split("?")[0].split("/").slice(-4).join("/"),
    readyState: v.readyState,
    currentTime: Math.round(v.currentTime * 10) / 10,
    paused: v.paused,
    frame: v.videoWidth + "x" + v.videoHeight,
    textTrackCount: tracks.length,
    textTracks: tracks,
    trackNodes: nodes,
    playlistsFetched: resources.filter((e) => /\.m3u8/.test(e.name)).length,
    segmentsFetched: resources.filter((e) => /\.ts(\?|$)/.test(e.name)).length,
  });
})()
'@
}

$rows = New-Object System.Collections.Generic.List[string]
function Log([string]$line) {
  $row = "{0} {1}" -f (Get-Date).ToString("HH:mm:ss"), $line
  $rows.Add($row)
  Write-Output $row
}

if (-not $AlreadyPlaying) {
  $card = if ($OpenAria) { Center-Of-Exact $OpenAria } else { Center-Of-Prefix $OPEN_PREFIX }
  Log ("opened release: " + $card.label)
  Click-At $card.x $card.y
  Start-Sleep -Seconds 3

  $play = Center-Of-Prefix $PLAY_PREFIX
  Log ("pressed play: " + $play.label)
  Click-At $play.x $play.y
}

$deadline = (Get-Date).AddSeconds(120)
$playing = $false
while ((Get-Date) -lt $deadline -and -not $playing) {
  Start-Sleep -Seconds 3
  $first = Get-Sample
  if ($first) {
    $state = $first | ConvertFrom-Json
    $playing = $state.readyState -ge 2 -and $state.currentTime -gt 1
  }
}
if (-not $playing) { throw "no playing media element appeared" }

for ($i = 1; $i -le $Samples; $i++) {
  Log ("sample ${i}: " + (Get-Sample))
  if ($i -lt $Samples) { Start-Sleep -Seconds $EverySec }
}

$rows | Set-Content -Path (Join-Path $PSScriptRoot $Out) -Encoding UTF8
Disconnect-Cdp
