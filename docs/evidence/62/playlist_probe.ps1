param(
  [int]$Port = 9224
)

# Reads the playlist the live player is using: how long a segment is and how many of them an
# Episode has. The bounded-retry policy is sized on these numbers, so they are measured, not
# assumed. Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port

Eval-Js @'
(async () => {
  const entry = performance.getEntriesByType("resource").find((e) => /\.m3u8/.test(e.name));
  if (!entry) return "no playlist fetched yet";
  const res = await fetch(entry.name);
  const body = await res.text();
  const target = (body.match(/#EXT-X-TARGETDURATION:(\d+)/) || [])[1];
  const inf = (body.match(/#EXTINF:([\d.]+)/g) || []).map((s) => parseFloat(s.slice(8)));
  const sorted = [...inf].sort((a, b) => a - b);
  return JSON.stringify({
    playlist: entry.name.split("?")[0].split("/").slice(-3).join("/"),
    status: res.status,
    targetduration: Number(target),
    segments: inf.length,
    shortest: sorted[0],
    longest: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    totalSeconds: Math.round(inf.reduce((a, b) => a + b, 0)),
  });
})()
'@ | Out-File -FilePath playlist-01.txt -Encoding utf8
Get-Content playlist-01.txt
Disconnect-Cdp
