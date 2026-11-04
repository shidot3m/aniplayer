param(
  [int]$Port = 9224,
  [switch]$KeepOpen
)

# Clicks the player's upscaler switch through the real menu, leaving the menu in the state it
# found it. The menu is a toggle, so it is opened only when its switch is not already in the
# DOM — that is what made blind gear clicks flip the wrong way. Evidence helper for #61.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp.ps1")
Connect-Cdp -Port $Port

# The two refusal texts are told apart by ASCII alone: the capability hint reads "WebGPU " and
# the renderer's fault reads "WebGPU-", so no Cyrillic has to survive the shell.
$switchJs = @'
(() => {
  const sw = Array.from(document.querySelectorAll('[role="switch"]'))
    .find((s) => (s.getAttribute("aria-label") || "").endsWith("4K"));
  if (!sw) return null;
  const q = sw.getBoundingClientRect();
  const row = ((sw.closest("div.flex") || sw.parentElement).parentElement || sw).textContent || "";
  return JSON.stringify({
    x: q.x + q.width / 2, y: q.y + q.height / 2,
    checked: sw.getAttribute("aria-checked"),
    disabled: sw.hasAttribute("disabled"),
    hintIsFault: /WebGPU-/.test(row),
    hintIsCapability: /WebGPU[^-]/.test(row),
  });
})()
'@

$gearJs = @'
(() => {
  const want = new TextDecoder().decode(Uint8Array.from(atob('0J3QsNGB0YLRgNC+0LnQutC4INC/0LvQtdC10YDQsA=='), (c) => c.charCodeAt(0)));
  const gear = Array.from(document.querySelectorAll("[title]")).find((e) => e.title === want);
  if (!gear) return null;
  const q = gear.getBoundingClientRect();
  return JSON.stringify({ x: q.x + q.width / 2, y: q.y + q.height / 2 });
})()
'@

function Get-Switch {
  $raw = Eval-Js $switchJs
  if (-not $raw) { return $null }
  return $raw | ConvertFrom-Json
}

function Open-Menu {
  for ($i = 0; $i -lt 3; $i++) {
    $sw = Get-Switch
    if ($sw) { return $sw }
    Move-MouseTo 640 700
    Start-Sleep -Milliseconds 400
    $gear = Eval-Js $gearJs
    if ($gear) {
      $g = $gear | ConvertFrom-Json
      Click-At $g.x $g.y
    }
    Start-Sleep -Milliseconds 700
  }
  throw "the upscaler switch never appeared in the player menu"
}

$sw = Open-Menu
Write-Output ("before: checked={0} disabled={1} hintIsFault={2} hintIsCapability={3}" -f $sw.checked, $sw.disabled, $sw.hintIsFault, $sw.hintIsCapability)
Click-At $sw.x $sw.y
Start-Sleep -Milliseconds 2500

$after = Get-Switch
Write-Output ("after:  checked={0} disabled={1} hintIsFault={2} hintIsCapability={3}" -f $after.checked, $after.disabled, $after.hintIsFault, $after.hintIsCapability)
Write-Output ("surface: " + (Eval-Js @'
JSON.stringify({
  canvas: !!document.querySelector("canvas"),
  videoOpacity: getComputedStyle(document.querySelector("video")).opacity,
  badge: !!Array.from(document.querySelectorAll("span")).find((s) => s.textContent === "4K Upscale"),
  currentTime: Math.round(document.querySelector("video").currentTime * 10) / 10,
})
'@))

if (-not $KeepOpen) {
  $gear = Eval-Js $gearJs
  if ($gear) {
    $g = $gear | ConvertFrom-Json
    Click-At $g.x $g.y
  }
}
