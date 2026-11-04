import { lazy } from "react";

export { useEnhancement } from "./renderer/useEnhancement";
export { usePlayerStore } from "./state/playerStore";
export { ANIME4K_PRESETS } from "./state/playerStoreDefaults";

// The overlay stays out of the barrel's static graph so it splits into a lazy chunk.
export const LazyPlayerOverlay = lazy(async () => {
  const module = await import("./ui/PlayerOverlay");
  return { default: module.PlayerOverlay };
});
