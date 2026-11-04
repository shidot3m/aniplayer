import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/shared/lib/utils";

/**
 * Leaves whichever fullscreen the app is in: the Tauri window's or the page's. The frame and
 * its controls live in one window now, so leaving fullscreen is a property of the playback
 * surface, not of a view — the store closes it when a session ends from the shell, and the
 * overlay does the same on its own way out.
 */
export async function exitAnyFullscreen(): Promise<void> {
  try {
    if (isTauriRuntime()) {
      await invoke("app_set_fullscreen", { fullscreen: false });
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
