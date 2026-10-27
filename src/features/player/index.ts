import { lazy } from "react";

export { usePlayerBackendSync } from "./hooks/usePlayerBackendSync";
export { usePlayerStore } from "./state/playerStore";
export { ANIME4K_PRESETS } from "./state/playerStoreDefaults";

// hls.js and anime4k-webgpu live only behind this boundary: the overlay must
// stay out of the barrel's static graph so it splits into a lazy chunk.
export const LazyPlayerOverlay = lazy(async () => {
  const module = await import("./ui/PlayerOverlay");
  return { default: module.PlayerOverlay };
});
