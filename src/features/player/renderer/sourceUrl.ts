import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/shared/lib/utils";

/**
 * The URL a media element may be pointed at for an Episode source.
 *
 * Inside the app the answer comes from Rust, which re-parses a stream URL and confines a
 * downloaded file to the downloads folder, handing back the asset-protocol URL for it. A page
 * that built that URL itself would have to name a path it is not allowed to read, and the
 * escaping has to keep the playlist's folder in the URL so hls.js can resolve the segments
 * beside it. Without Tauri — the plain-browser catalog mode — only stream URLs exist, and they
 * are already what the element loads.
 */
export async function resolvePlayableUrl(source: string): Promise<string> {
  if (!isTauriRuntime()) return source;
  return invoke<string>("player_resolve_source", { source });
}
