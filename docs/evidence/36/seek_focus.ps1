param(
  [int]$Port = 9224,
  [string]$Out = "seek-focus.txt"
)

# Measures arrow-key seeking on the live player while a slider holds focus. Both ways the issue
# names are driven: a real click on the seek bar and a real drag across it, each of which leaves
# input[type=range] focused, then real key events through WebView2's remote debugging port, with
# the media element read back after every press. The delta is the whole question: 5 s means the
# player hotkey ran, 0.1 s means the native range step did. Evidence helper for #36, not part of
# the app; the probe and the input primitives live in slider_cdp.ps1, shared with restore_state.ps1.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "slider_cdp.ps1")
Start-Pass -Port $Port -Out $Out

$ARROW_LEFT = 37
$ARROW_UP = 38
$ARROW_RIGHT = 39
$SHIFT = 8

Snap "home" | Out-Null

# 1. Open the Continue-watching card: the player resumes a real Episode with a real duration.
Click-Text "0J/RgNC+0LTQvtC70LbQuNGC0Yw=" | Out-Null
$opened = $false
$end = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $end) {
  Start-Sleep -Seconds 2
  $s = State
  if ($s.hasVideo -and $s.readyState -ge 2 -and $s.duration -gt 0) { $opened = $true; break }
}
Log ("episode-opened within90s={0}" -f $opened)
if (-not $opened) { throw "the player never produced a media element" }
$resume = Snap "episode-playing"
Log ("  pass started from t={0} volume={1}: restore_state.ps1 -ToTime {0} -ToVolume {1}" -f `
  $resume.t, $resume.volumeValue)

# 2. Pause first: while playing, the overlay auto-hides after 2.5 s and a later click would land on
# the video instead of the control it aims at.
Click-Element '[data-testid="player-play-pause-btn"]' | Out-Null
Start-Sleep -Milliseconds 400
Snap "paused" | Out-Null

# 3. A real click in the middle of the seek bar — the action the issue names — leaves focus on the
# range input and moves the position to about half the duration.
Click-Track "0.1" 0.5 | Out-Null
Start-Sleep -Milliseconds 400
$afterClick = Snap "seekbar-clicked"

# 4. Arrow keys with the seek bar focused: +5, then -30 with Shift.
Press-Key "ArrowRight" $ARROW_RIGHT
Start-Sleep -Milliseconds 400
$right = Snap "arrow-right"
Log ("  seekdelta={0}s seekvalue-delta={1}" -f (Delta $afterClick $right), [Math]::Round($right.seekValue - $afterClick.seekValue, 2))
Press-Key "ArrowLeft" $ARROW_LEFT $SHIFT
Start-Sleep -Milliseconds 400
$shiftLeft = Snap "shift-arrow-left"
Log ("  seekdelta={0}s" -f (Delta $right $shiftLeft))

# 5. The other half of the repro: a drag along the track, released with the pointer still over the
# range input, which is what keeps it focused.
Drag-Track "0.1" 0.25 0.65 | Out-Null
Start-Sleep -Milliseconds 400
$afterDrag = Snap "seekbar-dragged"
Press-Key "ArrowRight" $ARROW_RIGHT
Start-Sleep -Milliseconds 400
$dragRight = Snap "arrow-right-after-drag"
Log ("  seekdelta={0}s seekvalue-delta={1}" -f (Delta $afterDrag $dragRight), [Math]::Round($dragRight.seekValue - $afterDrag.seekValue, 2))

# 6. The volume slider takes focus the same way; its arrow keys still belong to the player.
Click-Track "1" 0.5 | Out-Null
Start-Sleep -Milliseconds 400
$volClicked = Snap "volumeslider-clicked"
Press-Key "ArrowRight" $ARROW_RIGHT
Start-Sleep -Milliseconds 400
$volRight = Snap "volumeslider-arrow-right"
Log ("  seekdelta={0}s volumedelta={1}" -f (Delta $volClicked $volRight), (Volume-Delta $volClicked $volRight))
Press-Key "ArrowUp" $ARROW_UP
Start-Sleep -Milliseconds 400
$volUp = Snap "volumeslider-arrow-up"
Log ("  volumedelta={0}" -f (Volume-Delta $volRight $volUp))

End-Pass
Write-Output "logged to $Out"
