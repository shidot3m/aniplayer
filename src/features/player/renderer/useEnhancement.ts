import { useMemo } from "react";
import { usePlayerStore } from "../state/playerStore";

/** What the enhancement controls say when this machine cannot run the WebGPU renderer. */
export const WEBGPU_REQUIRED_REASON = "Нужен WebGPU — без него апскейл не работает.";

/** Does this webview expose a GPU adapter the renderer could take frames from? */
export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && navigator.gpu !== undefined;
}

/**
 * The one verdict the enhancement controls and the playback surface share: whether the frame
 * is filtered, and what stops it from being. A preference saved on a machine with WebGPU stays
 * a preference — a machine without it reports the reason instead of painting a black plate.
 */
export function useEnhancement(): { active: boolean; blocked: string | null } {
  const enabled = usePlayerStore((state) => state.anime4kEnabled);
  const fault = usePlayerStore((state) => state.enhancementFault);

  return useMemo(() => {
    const blocked = hasWebGPU() ? fault : WEBGPU_REQUIRED_REASON;
    return { active: enabled && blocked === null, blocked };
  }, [enabled, fault]);
}
