import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

/** Downloaded files reach the webview only through the asset protocol. */
export function offlineStreamUrl(filePath: string): string {
  return isTauri() ? convertFileSrc(filePath) : filePath;
}
