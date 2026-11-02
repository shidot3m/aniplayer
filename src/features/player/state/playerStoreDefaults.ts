import { invoke } from "@tauri-apps/api/core";
import type {
  Anime4kPresetItem,
  EpisodeItem,
  PlayerHotkeysConfig,
  ReleaseDetails,
  VideoQuality,
} from "@/shared/types";

export const ANIME4K_PRESETS: Anime4kPresetItem[] = [
  {
    id: "Mode A (HQ)",
    label: "Mode A (HQ)",
    description: "Восстановление четких контуров и апскейл. Идеально для качественного 1080p.",
    tier: "HQ",
  },
  {
    id: "Mode A+A (HQ)",
    label: "Mode A+A (HQ)",
    description:
      "Максимальная четкость: двухпроходная CNN-реконструкция линий. Рекомендуется для мощных GPU.",
    tier: "HQ",
  },
  {
    id: "Mode B (HQ)",
    label: "Mode B (HQ)",
    description:
      "Шумоподавление и сглаживание артефактов компрессии. Идеально для 720p/1080p с дефектами.",
    tier: "HQ",
  },
  {
    id: "Mode B+B (HQ)",
    label: "Mode B+B (HQ)",
    description: "Усиленное подавление сильных артефактов и мягкая реконструкция контуров.",
    tier: "HQ",
  },
  {
    id: "Mode C (HQ)",
    label: "Mode C (HQ)",
    description: "Глубокое удаление шумов и артефактов. Для старых аниме, DVD-рипов и 480p.",
    tier: "HQ",
  },
  {
    id: "Mode C+A (HQ)",
    label: "Mode C+A (HQ)",
    description: "Удаление тяжелых шумов с последующим резким восстановлением контуров Mode A.",
    tier: "HQ",
  },
  {
    id: "Mode Fast (APU)",
    label: "Mode Fast (APU)",
    description:
      "Облегченный быстрый режим для встроенной графики (iGPU / APU) и слабых видеокарт.",
    tier: "Fast",
  },
];

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

export const getInitialAnime4kEnabled = (): boolean => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aniplayer_anime4k_enabled");
    if (saved !== null) {
      return saved === "true";
    }
  }
  return true;
};

export const getInitialAnime4kPreset = (): string => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("aniplayer_anime4k_preset");
    if (saved) {
      return saved;
    }
  }
  return "Mode A+A (HQ)";
};

export function getAvailableQualities(episode: EpisodeItem | null | undefined): VideoQuality[] {
  if (!episode) return ["1080p", "720p", "480p"];
  const list: VideoQuality[] = [];
  if (episode.hls_1080) list.push("1080p");
  if (episode.hls_720) list.push("720p");
  if (episode.hls_480) list.push("480p");
  return list.length > 0 ? list : ["720p"];
}

export function resolveEpisodeQuality(episode: EpisodeItem, preferred: VideoQuality): VideoQuality {
  const available = getAvailableQualities(episode);
  if (available.includes(preferred)) {
    return preferred;
  }
  return available[0] || "720p";
}

export async function fetchSettingsFromDb(): Promise<Partial<PlayerState>> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return {};
  }
  const patch: Partial<PlayerState> = {};
  try {
    const vol = await invoke<string | null>("db_get_setting", {
      key: "volume",
    });
    if (vol) {
      const parsed = parseFloat(vol);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        patch.volume = parsed;
        patch.isMuted = parsed === 0;
      }
    }
    const preset = await invoke<string | null>("db_get_setting", {
      key: "anime4k_preset",
    });
    if (preset) {
      patch.anime4kPreset = preset;
    }
    const a4k = await invoke<string | null>("db_get_setting", {
      key: "anime4k_enabled",
    });
    if (a4k !== null) {
      patch.anime4kEnabled = a4k === "true";
    }
    const qual = await invoke<string | null>("db_get_setting", {
      key: "preferred_quality",
    });
    if (qual === "1080p" || qual === "720p" || qual === "480p") {
      patch.preferredQuality = qual;
    }
    const hk = await invoke<string | null>("db_get_setting", {
      key: "hotkeys",
    });
    if (hk) {
      try {
        const parsed = JSON.parse(hk);
        patch.hotkeys = { ...DEFAULT_HOTKEYS, ...parsed };
      } catch (_e) {
        // Ignore invalid stored hotkey json
      }
    }
  } catch (_e) {
    // Backend not yet ready or table empty
  }
  return patch;
}
