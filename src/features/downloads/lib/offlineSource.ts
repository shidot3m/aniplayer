import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";

function isPlaylist(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".m3u8");
}

/**
 * A Matroska payload is indexed as itself: the backend remuxes it into MP4 on the
 * fly, so the extension is what marks the remux route. See the scanner's
 * `classify_video`, which decides what gets registered in the first place.
 */
function isRemuxCandidate(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".mkv");
}

/**
 * The URL a downloaded episode is played from. Local files reach the webview
 * through the asset protocol; a Matroska episode through the remux protocol, whose
 * URL the backend hands out after building the plan.
 */
export async function offlineStreamUrl(filePath: string): Promise<string> {
  if (!isTauri()) return filePath;
  if (isRemuxCandidate(filePath)) return remuxStreamUrl(filePath);

  const url = convertFileSrc(filePath);
  if (!isPlaylist(filePath)) return url;
  // hls.js resolves segment URIs relative to the playlist URL. `convertFileSrc`
  // encodes a Windows path as one `%5C`-separated segment, so relative names
  // would resolve against the protocol root. Forward slashes keep the folder
  // hierarchy; the asset protocol decodes them to a valid Windows path.
  return url.replace(/%5C/gi, "/");
}

async function remuxStreamUrl(filePath: string): Promise<string> {
  // The prepare step reads the container and builds the sample table, so a file
  // that cannot be remuxed fails here rather than opening on a black frame.
  return invoke<string>("downloader_prepare_stream", { filePath });
}
