param(
  [int]$Port = 9224,
  [Parameter(Mandatory = $true)][ValidateSet("none", "no-adapter", "restore")][string]$Mode
)

# Puts the live webview into the two states a machine can be in that this Windows box cannot
# reach by flag: no WebGPU API at all, and an API that refuses to hand over an adapter.
# WebView2 156 ignores --disable-webgpu and --disable-features=WebGPU (measured: navigator.gpu
# stays and requestAdapter still answers), so the app's own capability check is driven from
# the page instead. Evidence helper for #61, not part of the app.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

$js = switch ($Mode) {
  "none" { @'
(() => {
  if (!window.__gpuRef) window.__gpuRef = navigator.gpu;
  Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
  return JSON.stringify({ gpuNow: typeof navigator.gpu, own: Object.prototype.hasOwnProperty.call(navigator, "gpu") });
})()
'@ }
  "no-adapter" { @'
(() => {
  const real = window.__gpuRef || navigator.gpu;
  if (!window.__gpuRef) window.__gpuRef = real;
  const stub = {
    requestAdapter: async () => null,
    getPreferredCanvasFormat: () => real.getPreferredCanvasFormat(),
  };
  Object.defineProperty(navigator, "gpu", { value: stub, configurable: true });
  return JSON.stringify({ gpuNow: typeof navigator.gpu, adapterWillBe: "null" });
})()
'@ }
  "restore" { @'
(() => {
  if (window.__gpuRef) Object.defineProperty(navigator, "gpu", { value: window.__gpuRef, configurable: true });
  return JSON.stringify({ gpuNow: typeof navigator.gpu });
})()
'@ }
}

Write-Output "mode=$Mode -> $(Eval-Js $js)"
