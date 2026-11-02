import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

function isPlaylist(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".m3u8");
}

/** Downloaded files reach the webview only through the asset protocol. */
export function offlineStreamUrl(filePath: string): string {
  if (!isTauri()) return filePath;
  const url = convertFileSrc(filePath);
  if (!isPlaylist(filePath)) return url;
  // hls.js resolves segment URIs relative to the playlist URL. `convertFileSrc`
  // encodes a Windows path as one `%5C`-separated segment, so relative names
  // would resolve against the protocol root. Forward slashes keep the folder
  // hierarchy; the asset protocol decodes them to a valid Windows path.
  return url.replace(/%5C/gi, "/");
}
