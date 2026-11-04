param(
  [int]$Port = 9224,
  [string]$Js = "",
  [string]$Out = ""
)

# Prints what the live webview currently shows, so a pass can be driven from the outside.
# Evidence helper for #62, not part of the app. Files stay ASCII: PowerShell 5.1 reads a .ps1
# without a BOM as ANSI, so Russian UI strings are written as \u escapes inside the page instead.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "cdp_events.ps1")
Connect-Cdp -Port $Port

$result = if ($Js) {
  Eval-Js $Js
} else {
  Eval-Js @'
(() => {
  const open = "\u041e\u0442\u043a\u0440\u044b\u0442\u044c";
  const fail = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c";
  const v = document.querySelector("video");
  return JSON.stringify({
    href: location.href,
    hasVideo: !!v,
    cards: Array.from(document.querySelectorAll("[aria-label]"))
      .map((e) => e.getAttribute("aria-label"))
      .filter((l) => l && l.startsWith(open))
      .slice(0, 6),
    buttons: Array.from(document.querySelectorAll("button,[role='button'],a"))
      .map((e) => (e.textContent || "").trim() || e.getAttribute("aria-label") || "")
      .filter((t) => t)
      .slice(0, 30),
    fault: v ? document.body.innerText.split("\n").filter((l) => l.includes(fail)).join(" / ") : null,
    text: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
  });
})()
'@
}
Disconnect-Cdp
if ($Out) {
  # Console output goes through the OEM codepage; the log file keeps the Russian readable.
  $result | Out-File -FilePath $Out -Encoding utf8
  Write-Output "wrote $Out"
} else {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $result
}
