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
 * is filtered, what stops it from being, and what the renderer itself said when it tried.
 * A machine without WebGPU is out of order for the session; a renderer that refused once can
 * be asked again, because a driver hiccup is not a missing feature.
 */
export function useEnhancement(): {
  active: boolean;
  blocked: string | null;
  fault: string | null;
} {
  const enabled = usePlayerStore((state) => state.anime4kEnabled);
  const fault = usePlayerStore((state) => state.enhancementFault);

  return useMemo(() => {
    const blocked = hasWebGPU() ? null : WEBGPU_REQUIRED_REASON;
    return { active: enabled && blocked === null && fault === null, blocked, fault };
  }, [enabled, fault]);
}
