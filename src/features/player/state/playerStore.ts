import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { API_BASE_URL } from "@/shared/lib/constants";
import type { PlayerHotkeysConfig, ReleaseDetails, VideoQuality } from "@/shared/types";
import {
  DEFAULT_HOTKEYS,
  fetchSettingsFromDb,
  getInitialAnime4kEnabled,
  getInitialAnime4kPreset,
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
  anime4kPreset: getInitialAnime4kPreset(),
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
        if (fullRel?.episodes?.length) {
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
  },

  playEpisode: async (release, episode, startPos = 0) => {
    await get().openPlayer(release, episode, startPos);
  },

  closePlayer: async () => {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("app_set_fullscreen", { fullscreen: false });
      }
    } catch (_e) {
      // ignore
    }
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (_e) {
      // ignore
    }

    set({
      isPlayerOpen: false,
      isPlaying: false,
      currentRelease: null,
      currentEpisode: null,
    });
  },

  play: async () => {
    set({ isPlaying: true });
  },

  pause: async () => {
    set({ isPlaying: false });
  },

  togglePlay: async () => {
    if (get().isPlaying) {
      await get().pause();
    } else {
      await get().play();
    }
  },

  seek: async (seconds: number) => {
    set({ currentTime: seconds });
  },

  seekTo: async (seconds: number) => {
    await get().seek(seconds);
  },

  seekRelative: async (offset: number) => {
    const newPos = Math.max(0, get().currentTime + offset);
    set({ currentTime: newPos });
  },

  setVolume: async (volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_volume", String(clamped));
    }
    try {
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
      set({ isMuted: true });
    }
  },

  setSpeed: async (speed: number) => {
    set({ speed });
  },

  setPreset: async (preset: string) => {
    set({ anime4kPreset: preset });
    if (typeof window !== "undefined") {
      localStorage.setItem("aniplayer_anime4k_preset", preset);
    }
    try {
      await invoke("db_save_setting", {
        key: "anime4k_preset",
        value: preset,
      });
    } catch (_e) {
      // Browser mode or backend not ready
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

    // Auto-play next episode when reaching the end
    if (state.autoplayNext && duration > 0 && time >= duration - 1.5) {
      get().playNextEpisode();
    }
  },
}));
