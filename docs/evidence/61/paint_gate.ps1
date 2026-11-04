param(
  [int]$Port = 9224,
  [int]$Throttle = 20,
  [int]$Samples = 40
)

# Watches the moment the enhancement is switched on: the element must stay visible until the
# canvas actually holds a painted frame. CPU throttling stretches the ~100 ms window in which
# the first frame is still on its way, which is exactly when an ungated surface would show a
# black plate. The sampler runs in the page and is read afterwards, because a CDP call that
# awaits it would block the click it is supposed to observe. Evidence helper for #61.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

Invoke-Cdp "Emulation.setCPUThrottlingRate" @{ rate = $Throttle } | Out-Null

$install = @'
(() => {
  window.__trace = { t0: 0, rows: [] };
  const video = document.querySelector("video");
  const before = getComputedStyle(video).opacity;
  window.__trace.before = before;
  const sample = () => {
    const canvas = document.querySelector("canvas");
    window.__trace.rows.push({
      tMs: Math.round(performance.now() - window.__trace.t0),
      canvas: !!canvas,
      canvasSize: canvas ? canvas.width + "x" + canvas.height : null,
      videoOpacity: getComputedStyle(video).opacity,
    });
    if (window.__trace.rows.length < window.__trace.limit) setTimeout(sample, 40);
  };
  window.__trace.limit = 40;
  window.__trace.start = () => {
    window.__trace.t0 = performance.now();
    sample();
  };
  return "sampler installed";
})()
'@
Invoke-Cdp "Runtime.evaluate" @{ expression = $install; returnByValue = $true } | Out-Null

$sw = Eval-Js @'
(() => {
  const sw = Array.from(document.querySelectorAll('[role="switch"]'))
    .find((s) => (s.getAttribute("aria-label") || "").endsWith("4K"));
  if (!sw) return null;
  const q = sw.getBoundingClientRect();
  return JSON.stringify({ x: q.x + q.width / 2, y: q.y + q.height / 2, checked: sw.getAttribute("aria-checked") });
})()
'@
if (-not $sw) { throw "the upscaler switch is not in the player menu" }
$p = $sw | ConvertFrom-Json
Write-Output "switch checked before the click: $($p.checked)"

Eval-Js "window.__trace.limit = $Samples; window.__trace.start(); 'sampling'" | Out-Null
Click-At $p.x $p.y
Start-Sleep -Milliseconds 2200

$dump = Eval-Js "JSON.stringify(window.__trace)"
$trace = $dump | ConvertFrom-Json
$hidden = @($trace.rows | Where-Object { $_.videoOpacity -eq "0" })
$painted = @($trace.rows | Where-Object { $_.canvas })
Write-Output "video opacity before the click: $($trace.before)"
Write-Output ("canvas mounted from {0} ms; element hidden from {1} ms" -f `
  $(if ($painted.Count) { $painted[0].tMs } else { "never" }), `
  $(if ($hidden.Count) { $hidden[0].tMs } else { "never" }))
foreach ($row in $trace.rows | Select-Object -First 14) {
  Write-Output ("  t={0,5} ms canvas={1,-5} size={2,-11} videoOpacity={3}" -f $row.tMs, $row.canvas, $row.canvasSize, $row.videoOpacity)
}

Invoke-Cdp "Emulation.setCPUThrottlingRate" @{ rate = 1 } | Out-Null
