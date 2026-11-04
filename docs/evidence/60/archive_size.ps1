$ErrorActionPreference = "Stop"
# The helper lives under docs/evidence/60, so the project root is three levels up.
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
Set-Location $root
if (Test-Path Aniplayer-portable.zip) { Remove-Item Aniplayer-portable.zip -Force }
Compress-Archive -Path dist_portable\* -DestinationPath Aniplayer-portable.zip -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Get-Item Aniplayer-portable.zip
$exe = Get-Item dist_portable\aniplayer.exe
$mpvUnpacked = 100
"[OK] Aniplayer-portable.zip = {0:N1} MB (compressed), aniplayer.exe = {1:N1} MB" -f ($zip.Length / 1MB), ($exe.Length / 1MB)
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
try {
  "entries:"
  $archive.Entries | ForEach-Object { "  {0} ({1:N0} bytes)" -f $_.FullName, $_.Length }
  $bad = @($archive.Entries | Where-Object { $_.FullName -match '^(mpv/|shaders/)' })
  if ($bad.Count) { throw "archive carries a media runtime or shaders: $($bad.FullName -join ', ')" }
  "[OK] no mpv/ and no shaders/ in the archive"
} finally {
  $archive.Dispose()
}
"reference: the mpv-era bundle carried a ~$mpvUnpacked MB unpacked mpv/ runtime plus shaders/anime4k/"
