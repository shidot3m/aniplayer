import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { DownloadProgressEvent, DownloadedEpisodeMeta } from "../types";

interface DownloadState {
  downloadedEpisodes: DownloadedEpisodeMeta[];
  activeDownloads: Record<string, DownloadProgressEvent>;
  isWidgetExpanded: boolean;
  isWidgetVisible: boolean;
  isLoading: boolean;

  // Actions
  fetchDownloadedEpisodes: () => Promise<void>;
  deleteDownloadedEpisode: (episodeId: string, deleteFile?: boolean) => Promise<void>;
  openDownloadsFolder: (releaseId?: number) => Promise<void>;
  listenToProgress: () => Promise<() => void>;
  toggleWidgetExpanded: () => void;
  setWidgetExpanded: (expanded: boolean) => void;
  setWidgetVisible: (visible: boolean) => void;
  dismissDownload: (episodeId: string) => void;
  cancelDownload: (episodeId: string) => Promise<void>;
  cancelAllDownloads: () => Promise<void>;
  clearCompletedDownloads: () => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloadedEpisodes: [],
  activeDownloads: {},
  isWidgetExpanded: true,
  isWidgetVisible: true,
  isLoading: false,

  fetchDownloadedEpisodes: async () => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    set({ isLoading: true });
    try {
      const items = await invoke<DownloadedEpisodeMeta[]>("db_get_all_downloaded_episodes");
      set({ downloadedEpisodes: items || [], isLoading: false });
    } catch (err) {
      console.error("Failed to fetch downloaded episodes:", err);
      set({ isLoading: false });
    }
  },

  deleteDownloadedEpisode: async (episodeId: string, deleteFile = true) => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    try {
      await invoke("downloader_delete_episode", { episodeId, deleteFile });
      await get().fetchDownloadedEpisodes();
    } catch (err) {
      console.error("Failed to delete downloaded episode:", err);
    }
  },

  openDownloadsFolder: async (releaseId?: number) => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    try {
      await invoke("downloader_open_folder", { releaseId: releaseId ?? null });
    } catch (err) {
      console.error("Failed to open downloads folder:", err);
    }
  },

  listenToProgress: async () => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return () => {
        // No-op cleanup for non-Tauri browser environment
      };
    }

    try {
      const unlisten = await listen<DownloadProgressEvent>("download-progress", (event) => {
        const payload = event.payload;

        if (payload.status === "CANCELLED") {
          set((state) => {
            const copy = { ...state.activeDownloads };
            delete copy[payload.episodeId];
            return { activeDownloads: copy };
          });
          return;
        }

        set((state) => ({
          activeDownloads: {
            ...state.activeDownloads,
            [payload.episodeId]: payload,
          },
          isWidgetVisible: true,
        }));

        if (payload.status === "COMPLETED") {
          get().fetchDownloadedEpisodes();
        }
      });

      return unlisten;
    } catch (err) {
      console.error("Failed to listen to download-progress:", err);
      return () => {
        // No-op cleanup on listener registration failure
      };
    }
  },

  toggleWidgetExpanded: () => set((state) => ({ isWidgetExpanded: !state.isWidgetExpanded })),
  setWidgetExpanded: (expanded: boolean) => set({ isWidgetExpanded: expanded }),
  setWidgetVisible: (visible: boolean) => set({ isWidgetVisible: visible }),

  dismissDownload: (episodeId: string) => {
    set((state) => {
      const copy = { ...state.activeDownloads };
      delete copy[episodeId];
      return { activeDownloads: copy };
    });
  },

  cancelDownload: async (episodeId: string) => {
    // Immediately remove from active downloads in frontend
    set((state) => {
      const copy = { ...state.activeDownloads };
      delete copy[episodeId];
      return { activeDownloads: copy };
    });

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        await invoke("downloader_cancel_episode", { episodeId });
      } catch (err) {
        console.error("Failed to cancel episode download:", err);
      }
    }
  },

  cancelAllDownloads: async () => {
    set({ activeDownloads: {} });
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        await invoke("downloader_cancel_all");
      } catch (err) {
        console.error("Failed to cancel all downloads:", err);
      }
    }
  },

  clearCompletedDownloads: () => {
    set((state) => {
      const active: Record<string, DownloadProgressEvent> = {};
      for (const [id, item] of Object.entries(state.activeDownloads)) {
        if (item.status === "DOWNLOADING") {
          active[id] = item;
        }
      }
      return { activeDownloads: active };
    });
  },
}));
