import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { EpisodeItem, ReleaseDetails } from "../types";

interface PlayerState {
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
  activeQuality: "1080" | "720" | "480";
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
  setQuality: (quality: "1080" | "720" | "480") => Promise<void>;
  playNextEpisode: () => Promise<void>;
  playPrevEpisode: () => Promise<void>;
  setDrawerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  updateTime: (time: number, duration: number) => void;
  syncFromBackend: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

const getInitialVolume = (): number => {
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlayerOpen: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: getInitialVolume(),
  isMuted: false,
  speed: 1.0,
  anime4kPreset: "Mode A+A (HQ)",
  anime4kEnabled: true,
  autoSkipOpening: true,
  autoSkipEnding: true,
  autoSkipOpEd: true,
  autoplayNext: true,
  activeQuality: "1080",
  currentRelease: null,
  currentEpisode: null,
  isDrawerOpen: false,
  isSettingsOpen: false,

  openPlayer: async (release, episode, startPos = 0) => {
    // Select video stream URL based on quality
    const url = episode.hls_1080 || episode.hls_720 || episode.hls_480 || "";

    set({
      isPlayerOpen: true,
      currentRelease: release,
      currentEpisode: episode,
      currentTime: startPos,
      duration: episode.duration || 0,
      isPlaying: true,
    });

    try {
      await invoke("player_init", { hwnd: null });
      if (url) {
        await invoke("player_load_video", { url, startPos });
        const preset = get().anime4kEnabled ? get().anime4kPreset : "OFF";
        await invoke("player_set_shader_preset", { preset });
        await invoke("player_set_volume", { volume: get().volume });
      }
    } catch (e) {
      console.error("Failed to open player in backend:", e);
    }
  },

  playEpisode: async (release, episode, startPos = 0) => {
    await get().openPlayer(release, episode, startPos);
  },

  closePlayer: async () => {
    try {
      await invoke("player_pause");
    } catch (e) {
      console.error(e);
    }
    set({ isPlayerOpen: false, isPlaying: false });
  },

  play: async () => {
    try {
      await invoke("player_play");
      set({ isPlaying: true });
    } catch (e) {
      console.error(e);
    }
  },

  pause: async () => {
    try {
      await invoke("player_pause");
      set({ isPlaying: false });
    } catch (e) {
      console.error(e);
    }
  },

  togglePlay: async () => {
    if (get().isPlaying) {
      await get().pause();
    } else {
      await get().play();
    }
  },

  seek: async (seconds: number) => {
    try {
      await invoke("player_seek", { seconds });
      set({ currentTime: seconds });
    } catch (e) {
      console.error(e);
    }
  },

  seekTo: async (seconds: number) => {
    await get().seek(seconds);
  },

  seekRelative: async (offset: number) => {
    try {
      await invoke("player_seek_relative", { offset });
      const newPos = Math.max(0, get().currentTime + offset);
      set({ currentTime: newPos });
    } catch (e) {
      console.error(e);
    }
  },

  setVolume: async (volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_volume", String(clamped));
    }
    try {
      await invoke("player_set_volume", { volume: clamped });
      await invoke("db_save_setting", { key: "volume", value: String(clamped) });
    } catch (e) {
      console.error(e);
    }
  },

  toggleMute: async () => {
    const isMuted = get().isMuted;
    if (isMuted) {
      const restoreVol = get().volume || 80;
      await get().setVolume(restoreVol);
      set({ isMuted: false });
    } else {
      try {
        await invoke("player_set_volume", { volume: 0 });
        set({ isMuted: true });
      } catch (e) {
        console.error(e);
      }
    }
  },

  setSpeed: async (speed: number) => {
    set({ speed });
    try {
      await invoke("player_set_speed", { speed });
    } catch (e) {
      console.error(e);
    }
  },

  setPreset: async (preset: string) => {
    set({ anime4kPreset: preset });
    if (get().anime4kEnabled) {
      try {
        await invoke("player_set_shader_preset", { preset });
      } catch (e) {
        console.error(e);
      }
    }
  },

  setAnime4kPreset: async (preset: string) => {
    await get().setPreset(preset);
  },

  toggleAnime4k: async () => {
    const enabled = !get().anime4kEnabled;
    set({ anime4kEnabled: enabled });
    const preset = enabled ? get().anime4kPreset : "OFF";
    try {
      await invoke("player_set_shader_preset", { preset });
    } catch (e) {
      console.error(e);
    }
  },

  setAutoSkipOpening: (enabled: boolean) => set({ autoSkipOpening: enabled }),
  setAutoSkipEnding: (enabled: boolean) => set({ autoSkipEnding: enabled }),
  setAutoSkipOpEd: (enabled: boolean) =>
    set({ autoSkipOpEd: enabled, autoSkipOpening: enabled, autoSkipEnding: enabled }),
  setAutoplayNext: (enabled: boolean) => set({ autoplayNext: enabled }),

  setQuality: async (quality: "1080" | "720" | "480") => {
    set({ activeQuality: quality });
    const ep = get().currentEpisode;
    if (!ep) return;

    let url = ep.hls_1080;
    if (quality === "720" && ep.hls_720) url = ep.hls_720;
    if (quality === "480" && ep.hls_480) url = ep.hls_480;

    if (url) {
      const cur = get().currentTime;
      try {
        await invoke("player_load_video", { url, startPos: cur });
      } catch (e) {
        console.error(e);
      }
    }
  },

  playNextEpisode: async () => {
    const release = get().currentRelease;
    const current = get().currentEpisode;
    if (!release || !current || !release.episodes.length) return;

    const idx = release.episodes.findIndex((e) => e.id === current.id);
    if (idx >= 0 && idx + 1 < release.episodes.length) {
      const nextEp = release.episodes[idx + 1];
      await get().openPlayer(release, nextEp, 0);
    }
  },

  playPrevEpisode: async () => {
    const release = get().currentRelease;
    const current = get().currentEpisode;
    if (!release || !current || !release.episodes.length) return;

    const idx = release.episodes.findIndex((e) => e.id === current.id);
    if (idx > 0) {
      const prevEp = release.episodes[idx - 1];
      await get().openPlayer(release, prevEp, 0);
    }
  },

  setDrawerOpen: (open: boolean) => set({ isDrawerOpen: open }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),

  updateTime: (time: number, duration: number) => {
    const state = get();
    set({
      currentTime: time,
      duration: duration > 0 ? duration : state.duration,
    });

    // Auto-skip opening
    if (state.autoSkipOpening && state.currentEpisode?.opening) {
      const { start, stop } = state.currentEpisode.opening;
      if (start != null && stop != null && time >= start && time < stop) {
        get().seek(stop);
        return;
      }
    }

    // Auto-skip ending
    if (state.autoSkipEnding && state.currentEpisode?.ending) {
      const { start, stop } = state.currentEpisode.ending;
      if (start != null && stop != null && time >= start && time < stop) {
        get().seek(stop);
        return;
      }
    }

    // Auto-play next episode when reaching the end
    if (state.autoplayNext && duration > 0 && time >= duration - 1.5) {
      get().playNextEpisode();
    }
  },

  syncFromBackend: async () => {
    try {
      const vol = await invoke<number>("player_get_volume");
      const preset = await invoke<string>("player_get_current_preset");
      const paused = await invoke<boolean>("player_is_paused");
      const cur = await invoke<number>("player_get_time_pos");
      const dur = await invoke<number>("player_get_duration");

      set({
        volume: vol,
        anime4kPreset: preset,
        isPlaying: !paused,
        currentTime: cur,
        duration: dur > 0 ? dur : get().duration,
      });
    } catch (_e) {
      // Backend not ready yet or no active stream
    }
  },

  syncWithBackend: async () => {
    if (!get().isPlayerOpen) return;
    await get().syncFromBackend();
  },
}));
