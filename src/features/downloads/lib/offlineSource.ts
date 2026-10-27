import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Downloads live outside the webview origin, so playback reaches them through
 * the asset protocol. Outside Tauri (browser preview, tests) the plain path is
 * the only usable value.
 */
export function offlineStreamUrl(filePath: string): string {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return filePath;
  }
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}
