import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/shared/lib/utils";

/** The backend's verdict on a playback source, mirrored from `playback::ResolvedSource`. */
type ResolvedSource = { kind: "remote" | "local"; value: string };

/**
 * The URL a media element may be pointed at for an Episode source.
 *
 * Inside the app the answer comes from Rust, which re-parses a stream URL and confines a
 * local path to the downloads folder; a local file then becomes an asset-protocol URL because
 * the page cannot name a disk path it is allowed to read. Without Tauri — the plain-browser
 * catalog mode — only stream URLs exist, and they are already what the element loads.
 */
export async function resolvePlayableUrl(source: string): Promise<string> {
  if (!isTauriRuntime()) return source;
  const resolved = await invoke<ResolvedSource>("player_resolve_source", { source });
  return resolved.kind === "local" ? convertFileSrc(resolved.value) : resolved.value;
}
