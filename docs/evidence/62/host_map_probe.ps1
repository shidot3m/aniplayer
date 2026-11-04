param(
  [int]$Port = 9224,
  [int]$Segments = 12
)

# Measures how AniLiberty's CDN picks the backend a segment is served from: the playlist names
# every segment on the entry host, and each request answers with a 302 to a cache backend. Whether
# a retry of the same segment can ever reach a *different* machine decides what a bounded retry
# policy can do, so it is measured, not assumed: each of the next segments is fetched the way the
# player fetches it, and the final URL after the redirect is what the browser reports back.
# Evidence helper for #62, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port

Eval-Js @"
(async () => {
  const entry = performance.getEntriesByType('resource').find((e) => /\.m3u8/.test(e.name));
  if (!entry) return 'no playlist fetched yet';
  const playlistUrl = entry.name;
  const body = await (await fetch(playlistUrl)).text();
  const uris = body.split('\n').filter((l) => l.endsWith('.ts')).slice(0, $Segments);
  const rows = [];
  for (const uri of uris) {
    const url = new URL(uri, playlistUrl).href;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const stats = new AbortController();
      setTimeout(() => stats.abort(), 4000);
      let backend = 'no-answer';
      try {
        const res = await fetch(url, { signal: stats.signal });
        backend = new URL(res.url).host;
      } catch (e) {
        backend = 'aborted-or-' + e.name;
      }
      rows.push({ segment: url.split('/').pop(), attempt, backend });
    }
  }
  const bySegment = {};
  for (const r of rows) (bySegment[r.segment] ||= []).push(r.backend);
  return JSON.stringify({
    playlist: playlistUrl.split('/').slice(-3).join('/'),
    distinctBackends: [...new Set(rows.map((r) => r.backend))],
    perSegment: bySegment,
  }, null, 1);
})()
"@ | Out-File -FilePath hostmap-01.txt -Encoding utf8
Get-Content hostmap-01.txt
Disconnect-Cdp
