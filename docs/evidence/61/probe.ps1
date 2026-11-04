param(
  [int]$Port = 9224,
  [string]$Label = "state"
)

# One snapshot of the live page: what WebGPU the webview has, what the media element is doing,
# whether the renderer's canvas is over it, and which chunks the page has actually fetched.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

$js = @'
(async () => {
  const v = document.querySelector("video");
  const c = document.querySelector("canvas");
  const sw = Array.from(document.querySelectorAll('[role="switch"]'))
    .find((s) => (s.getAttribute("aria-label") || "").endsWith("4K"));
  const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
  const info = adapter && adapter.info ? adapter.info : null;
  const chunks = performance.getEntriesByType("resource")
    .filter((e) => /anime4k|hls|PlayerOverlay/.test(e.name))
    .map((e) => ({
      chunk: e.name.split("/").pop().replace(/-[^-]{8}\.js$/, ".js"),
      startMs: Math.round(e.startTime),
      durationMs: Math.round(e.duration),
    }));
  return JSON.stringify({
    pageNowMs: Math.round(performance.now()),
    webgpu: {
      api: typeof navigator.gpu !== "undefined",
      adapter: info
        ? { vendor: info.vendor, architecture: info.architecture, device: info.device, backend: info.backend || null }
        : (adapter ? "anonymous adapter" : null),
      preferredCanvasFormat: navigator.gpu ? navigator.gpu.getPreferredCanvasFormat() : null,
    },
    video: v ? {
      currentSrc: (v.currentSrc || "").slice(0, 40),
      readyState: v.readyState,
      currentTime: Math.round(v.currentTime * 10) / 10,
      paused: v.paused,
      frame: v.videoWidth + "x" + v.videoHeight,
      opacity: getComputedStyle(v).opacity,
    } : null,
    canvas: c ? {
      drawingBuffer: c.width + "x" + c.height,
      display: c.clientWidth + "x" + c.clientHeight,
      opacity: getComputedStyle(c).opacity,
    } : null,
    badge: !!Array.from(document.querySelectorAll("span")).find((s) => s.textContent === "4K Upscale"),
    upscalerSwitch: sw ? {
      checked: sw.getAttribute("aria-checked"),
      disabled: sw.hasAttribute("disabled"),
      hintMentionsWebGPU: /WebGPU/.test(((sw.closest("div.flex") || sw.parentElement || sw).parentElement || sw).textContent || ""),
    } : null,
    chunks,
  }, null, 1);
})()
'@

Write-Output "== $Label"
Write-Output (Eval-Js $js)
