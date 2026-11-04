param(
  [int]$Port = 9224,
  [int]$Seconds = 4
)

# Measures what the renderer draws against what the element plays: every presented frame
# carries its media time, and the audio clock is the element's currentTime. A picture that
# drifts shows up as a growing gap; a renderer that merely repaints the same frame shows up as
# a frame count far below the media rate. Evidence helper for #61.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

Eval-Js @'
(() => {
  window.__sync = { rows: [], stop: false };
  const video = document.querySelector("video");
  const step = (now, metadata) => {
    if (window.__sync.stop) return;
    window.__sync.rows.push({
      mediaTime: metadata.mediaTime,
      presentedFrames: metadata.presentedFrames,
      currentTime: video.currentTime,
      paused: video.paused,
    });
    video.requestVideoFrameCallback(step);
  };
  video.requestVideoFrameCallback(step);
  return "watching";
})()
'@ | Out-Null

Start-Sleep -Seconds $Seconds

$dump = Eval-Js @'
(() => {
  window.__sync.stop = true;
  const rows = window.__sync.rows;
  const gaps = rows.map((r) => Math.abs(r.mediaTime - r.currentTime));
  const video = document.querySelector("video");
  const canvas = document.querySelector("canvas");
  return JSON.stringify({
    frames: rows.length,
    seconds: rows.length ? Math.round((rows[rows.length - 1].mediaTime - rows[0].mediaTime) * 100) / 100 : 0,
    maxGapMs: Math.round(Math.max.apply(null, gaps) * 1000),
    medianGapMs: Math.round(gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] * 1000),
    presentedFramesAdvanced: rows.length ? rows[rows.length - 1].presentedFrames - rows[0].presentedFrames : 0,
    paused: video.paused,
    canvasSize: canvas ? canvas.width + "x" + canvas.height : null,
    videoSize: video.videoWidth + "x" + video.videoHeight,
  });
})()
'@

Write-Output "while the renderer paints: $dump"
