param(
  [Parameter(Mandatory = $true)][string]$Before,
  [Parameter(Mandatory = $true)][string]$After,
  [int]$Step = 3
)

# Compares two screenshots of the same paused frame: how much the pixels moved, and how much
# edge energy each one carries. Anime4K restores line detail, so the enhanced frame should be
# measurably sharper, not merely different. Evidence helper for #61, not part of the app.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-Bitmap([string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $path
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $bytes = New-Object byte[] ($data.Stride * $data.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $bmp.Dispose()
  return @{ width = $data.Width; height = $data.Height; stride = $data.Stride; pixels = $bytes }
}

function Get-EdgeEnergy($image, [int]$step) {
  # Laplacian magnitude over the central band, i.e. the picture and not the window chrome.
  $x0 = [int]($image.width * 0.06); $x1 = [int]($image.width * 0.94)
  $y0 = [int]($image.height * 0.30); $y1 = [int]($image.height * 0.92)
  $stride = $image.stride
  $sum = 0.0
  $count = 0
  for ($y = $y0; $y -lt $y1; $y += $step) {
    for ($x = $x0; $x -lt $x1; $x += $step) {
      $i = $y * $stride + $x * 3
      $here = $image.pixels[$i]
      $above = $image.pixels[$i - $stride]
      $below = $image.pixels[$i + $stride]
      $left = $image.pixels[$i - 3]
      $right = $image.pixels[$i + 3]
      $sum += [Math]::Abs(4 * $here - $above - $below - $left - $right)
      $count++
    }
  }
  return $sum / $count
}

$a = Get-Bitmap $Before
$b = Get-Bitmap $After
if ($a.width -ne $b.width -or $a.height -ne $b.height) { throw "screenshots differ in size" }

$diffSum = 0.0
$changed = 0
$total = 0
for ($i = 0; $i -lt $a.pixels.Length; $i += 3) {
  $d = [Math]::Abs($a.pixels[$i] - $b.pixels[$i]) + [Math]::Abs($a.pixels[$i + 1] - $b.pixels[$i + 1]) + [Math]::Abs($a.pixels[$i + 2] - $b.pixels[$i + 2])
  $diffSum += $d
  if ($d -gt 12) { $changed++ }
  $total++
}

$edgeBefore = Get-EdgeEnergy $a $Step
$edgeAfter = Get-EdgeEnergy $b $Step

Write-Output ("before            = {0}" -f (Split-Path $Before -Leaf))
Write-Output ("after             = {0}" -f (Split-Path $After -Leaf))
Write-Output ("meanChannelDelta  = {0}" -f [Math]::Round($diffSum / ($total * 3), 3))
Write-Output ("changedPixelPct   = {0}" -f [Math]::Round(100 * $changed / $total, 2))
Write-Output ("edgeEnergyBefore  = {0}" -f [Math]::Round($edgeBefore, 3))
Write-Output ("edgeEnergyAfter   = {0}" -f [Math]::Round($edgeAfter, 3))
