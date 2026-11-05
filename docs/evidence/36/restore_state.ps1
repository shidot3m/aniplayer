param(
  [int]$Port = 9224,
  [string]$Out = "seek-focus.txt",
  [Parameter(Mandatory = $true)][double]$ToTime,
  [Parameter(Mandatory = $true)][double]$ToVolume
)

# Puts the player back where the pass found it: the Continue-watching position the seek-bar clicks
# moved away from, and the volume the volume-slider click changed. Evidence helper for #36, not
# part of the app. A track click cannot land on an exact number — the thumb is inset from the
# element's box — so the two values are handed to the controls the way React expects them and the
# controls' own onChange does the seeking.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "slider_cdp.ps1")
Start-Pass -Port $Port -Out $Out

$setJs = @'
(() => {
  const byStep = (s) => Array.from(document.querySelectorAll('input[type="range"]')).find((r) => r.getAttribute("step") === s);
  const setValue = (step, value) => {
    const el = byStep(step);
    if (!el) throw new Error("no range input with step " + step);
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return Number(el.value);
  };
  setValue("1", __VOLUME__);
  return setValue("0.1", __TIME__);
})()
'@

$before = Snap "restore-before"
$js = $setJs.Replace("__VOLUME__", (ConvertTo-Json $ToVolume)).Replace("__TIME__", (ConvertTo-Json $ToTime))
$applied = Eval-Js $js
Log ("  seek input now reads {0}" -f $applied)
$after = Snap "restored"
Log ("  wanted t={0} volume={1}; the pass had left the player at t={2} volume={3}" -f `
  $ToTime, $ToVolume, $before.t, $before.volumeValue)

End-Pass
Write-Output ("restored t={0} volume={1}" -f $after.t, $after.volumeValue)
