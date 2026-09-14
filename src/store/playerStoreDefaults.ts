import type { EpisodeItem, PlayerHotkeysConfig, ReleaseDetails, VideoQuality } from "../types";

export const DEFAULT_HOTKEYS: PlayerHotkeysConfig = {
  togglePlay: "Space",
  seekBack: "ArrowLeft",
  seekForward: "ArrowRight",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  toggleMute: "KeyM",
  toggleFullscreen: "KeyF",
  skipOpEd: "KeyS",
  nextEpisode: "KeyN",
  prevEpisode: "KeyP",
};

export interface PlayerState {
  isPlayerOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  speed: number;
  anime4kPreset: string;
  anime4kEnabled: boolean;
  autoSkipOpening: boolean;
  autoSkipEnding: boolean;
  autoSkipOpEd: boolean;
  autoplayNext: boolean;
  activeQuality: VideoQuality;
  preferredQuality: VideoQuality;
  hotkeys: PlayerHotkeysConfig;
  currentRelease: ReleaseDetails | null;
  currentEpisode: EpisodeItem | null;
  isDrawerOpen: boolean;
  isSettingsOpen: boolean;

  // Actions
  openPlayer: (release: ReleaseDetails, episode: EpisodeItem, startPos?: number) => Promise<void>;
  playEpisode: (release: ReleaseDetails, episode: EpisodeItem, startPos?: number) => Promise<void>;
  closePlayer: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  seekRelative: (offset: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setPreset: (preset: string) => Promise<void>;
  setAnime4kPreset: (preset: string) => Promise<void>;
  toggleAnime4k: () => Promise<void>;
  setAutoSkipOpening: (enabled: boolean) => void;
  setAutoSkipEnding: (enabled: boolean) => void;
  setAutoSkipOpEd: (enabled: boolean) => void;
  setAutoplayNext: (enabled: boolean) => void;
  setQuality: (quality: VideoQuality) => Promise<void>;
  setPreferredQuality: (quality: VideoQuality) => Promise<void>;
  setHotkey: (action: keyof PlayerHotkeysConfig, code: string) => Promise<void>;
  resetHotkeys: () => Promise<void>;
  initSettings: () => Promise<void>;
  playNextEpisode: () => Promise<void>;
  playPrevEpisode: () => Promise<void>;
  setDrawerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  updateTime: (time: number, duration: number) => void;
  syncFromBackend: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

export const getInitialVolume = (): number => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aniplayer_volume");
    if (saved !== null) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
  }
  return 80;
};

export const getInitialQuality = (): VideoQuality => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aniplayer_preferred_quality");
    if (saved === "1080p" || saved === "720p" || saved === "480p") {
      return saved;
    }
  }
  return "1080p";
};

export const getInitialHotkeys = (): PlayerHotkeysConfig => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aniplayer_hotkeys");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_HOTKEYS, ...parsed };
      } catch (_e) {
        // Fall back to default hotkeys on JSON parse error
      }
    }
  }
  return DEFAULT_HOTKEYS;
};
