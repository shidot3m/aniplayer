import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { API_BASE_URL } from "../lib/constants";
import type { PlayerHotkeysConfig, ReleaseDetails, VideoQuality } from "../types";
import {
  DEFAULT_HOTKEYS,
  fetchSettingsFromDb,
  getInitialAnime4kEnabled,
  getInitialHotkeys,
  getInitialQuality,
  getInitialVolume,
  type PlayerState,
  resolveEpisodeQuality,
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
  anime4kEnabled: getInitialAnime4kEnabled(),
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
    let activeRelease = release;
    let activeEpisode = episode;

    // If episode doesn't have stream URLs yet, fetch full release details
    if (!activeEpisode.hls_1080 && !activeEpisode.hls_720 && !activeEpisode.hls_480) {
      try {
        let fullRel: ReleaseDetails | null = null;
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          fullRel = await invoke<ReleaseDetails>("api_get_release", {
            idOrAlias: String(release.id),
          }).catch(() => null);
        }
        if (!fullRel) {
          const res = await fetch(`${API_BASE_URL}/anime/releases/${release.id}`).catch(() => null);
          if (res?.ok) fullRel = await res.json();
        }
        if (fullRel && fullRel.episodes?.length) {
          activeRelease = fullRel;
          const found = fullRel.episodes.find(
            (e) => e.id === episode.id || e.ordinal === episode.ordinal,
          );
          if (found) activeEpisode = found;
        }
      } catch (err) {
        console.error("Failed to load full release in openPlayer:", err);
      }
    }

    const resolvedQuality = resolveEpisodeQuality(activeEpisode, get().preferredQuality);

    set({
      isPlayerOpen: true,
      currentRelease: activeRelease,
      currentEpisode: activeEpisode,
      currentTime: startPos,
      duration: activeEpisode.duration || 0,
      isPlaying: true,
      activeQuality: resolvedQuality,
    });

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        await invoke("player_stop");
      } catch (_e) {
        // ignore
      }
    }
  },

  playEpisode: async (release, episode, startPos = 0) => {
    await get().openPlayer(release, episode, startPos);
  },

  closePlayer: async () => {
    set({
      isPlayerOpen: false,
      isPlaying: false,
      currentRelease: null,
      currentEpisode: null,
    });
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        await invoke("player_stop");
      } catch (_e) {
        // ignore
      }
    }
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
      await invoke("db_save_setting", {
        key: "volume",
        value: String(clamped),
      });
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
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_anime4k_enabled", String(enabled));
    }
    try {
      await invoke("db_save_setting", {
        key: "anime4k_enabled",
        value: String(enabled),
      });
      const preset = enabled ? get().anime4kPreset : "OFF";
      await invoke("player_set_shader_preset", { preset });
    } catch (e) {
      console.error(e);
    }
  },

  setAutoSkipOpening: (enabled: boolean) => set({ autoSkipOpening: enabled }),
  setAutoSkipEnding: (enabled: boolean) => set({ autoSkipEnding: enabled }),
  setAutoSkipOpEd: (enabled: boolean) =>
    set({
      autoSkipOpEd: enabled,
      autoSkipOpening: enabled,
      autoSkipEnding: enabled,
    }),
  setAutoplayNext: (enabled: boolean) => set({ autoplayNext: enabled }),

  setQuality: async (quality: VideoQuality) => {
    set({ activeQuality: quality });
  },

  setPreferredQuality: async (quality: VideoQuality) => {
    set({ preferredQuality: quality });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_preferred_quality", quality);
    }
    try {
      await invoke("db_save_setting", {
        key: "preferred_quality",
        value: quality,
      });
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
      await invoke("db_save_setting", {
        key: "hotkeys",
        value: JSON.stringify(updated),
      });
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
      await invoke("db_save_setting", {
        key: "hotkeys",
        value: JSON.stringify(DEFAULT_HOTKEYS),
      });
    } catch (e) {
      console.error(e);
    }
  },

  initSettings: async () => {
    const patch = await fetchSettingsFromDb();
    if (Object.keys(patch).length > 0) {
      set(patch);
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

      // Only update time and isPlaying if backend has an active running stream
      if (dur > 0 && cur >= 0) {
        set({
          volume: vol,
          anime4kPreset: preset,
          isPlaying: !paused,
          currentTime: cur,
          duration: dur,
        });
      } else {
        set({
          volume: vol,
          anime4kPreset: preset,
        });
      }
    } catch (_e) {
      // Backend not ready yet or no active stream
    }
  },

  syncWithBackend: async () => {
    if (!get().isPlayerOpen) return;
    await get().syncFromBackend();
  },
}));
