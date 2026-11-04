import { playback } from "@/features/player/renderer/playbackSession";
import { usePlayerStore } from "@/features/player/state/playerStore";

/**
 * The application shell with no player open. The playback session is a singleton and the store
 * outlives every render, so a test that means to start from the beginning has to say so: one
 * function, so the two files that drive playback cannot drift apart on what "closed" means.
 */
export function closePlayerShell(): void {
  playback.close();
  localStorage.clear();
  usePlayerStore.setState({
    isPlayerOpen: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    isMuted: false,
    speed: 1,
    anime4kEnabled: false,
    anime4kPreset: "Mode A (HQ)",
    preferredQuality: "1080p",
    activeQuality: "1080p",
    autoplayNext: false,
    autoSkipOpEd: false,
    playbackError: null,
    enhancementFault: null,
    currentRelease: null,
    currentEpisode: null,
  });
}
