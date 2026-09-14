import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { PlayerHotkeysConfig, VideoQuality } from "../types";
import {
  DEFAULT_HOTKEYS,
  getInitialHotkeys,
  getInitialQuality,
  getInitialVolume,
  type PlayerState,
} from "./playerStoreDefaults";

export { DEFAULT_HOTKEYS };

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
  activeQuality: "1080p",
  preferredQuality: getInitialQuality(),
  hotkeys: getInitialHotkeys(),
  currentRelease: null,
  currentEpisode: null,
  isDrawerOpen: false,
  isSettingsOpen: false,

  openPlayer: async (release, episode, startPos = 0) => {
    // Select video stream URL based on preferred quality with fallback
    const pref = get().preferredQuality;
    let url = "";
    let resolvedQuality: VideoQuality = "1080p";

    if (pref === "1080p" && episode.hls_1080) {
      url = episode.hls_1080;
      resolvedQuality = "1080p";
    } else if (pref === "720p" && episode.hls_720) {
      url = episode.hls_720;
      resolvedQuality = "720p";
    } else if (pref === "480p" && episode.hls_480) {
      url = episode.hls_480;
      resolvedQuality = "480p";
    } else {
      if (episode.hls_1080) {
        url = episode.hls_1080;
        resolvedQuality = "1080p";
      } else if (episode.hls_720) {
        url = episode.hls_720;
        resolvedQuality = "720p";
      } else if (episode.hls_480) {
        url = episode.hls_480;
        resolvedQuality = "480p";
      }
    }

    set({
      isPlayerOpen: true,
      currentRelease: release,
      currentEpisode: episode,
      currentTime: startPos,
      duration: episode.duration || 0,
      isPlaying: true,
      activeQuality: resolvedQuality,
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

  setQuality: async (quality: VideoQuality) => {
    set({ activeQuality: quality });
    const ep = get().currentEpisode;
    if (!ep) return;

    let url = ep.hls_1080;
    if (quality === "720p" && ep.hls_720) url = ep.hls_720;
    else if (quality === "480p" && ep.hls_480) url = ep.hls_480;
    else if (quality === "1080p" && ep.hls_1080) url = ep.hls_1080;
    else url = ep.hls_1080 || ep.hls_720 || ep.hls_480;

    if (url) {
      const cur = get().currentTime;
      try {
        await invoke("player_load_video", { url, startPos: cur });
      } catch (e) {
        console.error(e);
      }
    }
  },

  setPreferredQuality: async (quality: VideoQuality) => {
    set({ preferredQuality: quality });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_preferred_quality", quality);
    }
    try {
      await invoke("db_save_setting", { key: "preferred_quality", value: quality });
    } catch (e) {
      console.error(e);
    }
  },

  setHotkey: async (action: keyof PlayerHotkeysConfig, code: string) => {
    const updated = { ...get().hotkeys, [action]: code };
    set({ hotkeys: updated });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_hotkeys", JSON.stringify(updated));
    }
    try {
      await invoke("db_save_setting", { key: "hotkeys", value: JSON.stringify(updated) });
    } catch (e) {
      console.error(e);
    }
  },

  resetHotkeys: async () => {
    set({ hotkeys: DEFAULT_HOTKEYS });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_hotkeys", JSON.stringify(DEFAULT_HOTKEYS));
    }
    try {
      await invoke("db_save_setting", { key: "hotkeys", value: JSON.stringify(DEFAULT_HOTKEYS) });
    } catch (e) {
      console.error(e);
    }
  },

  initSettings: async () => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    try {
      const vol = await invoke<string | null>("db_get_setting", { key: "volume" });
      if (vol) {
        const parsed = parseFloat(vol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          set({ volume: parsed, isMuted: parsed === 0 });
        }
      }
      const preset = await invoke<string | null>("db_get_setting", { key: "anime4k_preset" });
      if (preset) {
        set({ anime4kPreset: preset });
      }
      const qual = await invoke<string | null>("db_get_setting", { key: "preferred_quality" });
      if (qual === "1080p" || qual === "720p" || qual === "480p") {
        set({ preferredQuality: qual });
      }
      const hk = await invoke<string | null>("db_get_setting", { key: "hotkeys" });
      if (hk) {
        try {
          const parsed = JSON.parse(hk);
          set({ hotkeys: { ...DEFAULT_HOTKEYS, ...parsed } });
        } catch (_e) {
          // Ignore invalid stored hotkey json
        }
      }
    } catch (_e) {
      // Backend not yet ready or table empty
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
