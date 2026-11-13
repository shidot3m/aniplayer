import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { DownloadedEpisodeMeta, DownloadProgressEvent } from "@/shared/types";

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

  /**
   * Reports a download that never reached the backend queue as a failure line in the widget. The
   * backend emits `download-progress` only for a task it accepted, so a stream that could not be
   * started, or a start call that failed, would otherwise leave the user with no feedback at all —
   * issue #77 retired the native `alert` that used to cover exactly this.
   */
  notifyFailure: (notice: {
    episodeId: string;
    releaseId: number;
    episodeOrdinal: number;
    message: string;
  }) => void;

  /**
   * Starts a FAILED download again — the "докачать" action the offline library offers for an
   * episode the startup pass reconciled after its download was interrupted (issue #78). The row
   * already carries the release, ordinal, quality and skip timecodes; only the HLS stream is not
   * stored, so the caller supplies it from the catalog. An empty stream means the source could not
   * be resolved: report it through the widget instead of starting a doomed download.
   */
  retryDownload: (meta: DownloadedEpisodeMeta, m3u8Url: string) => Promise<void>;
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
      return await listen<DownloadProgressEvent>("download-progress", (event) => {
        const payload = event.payload;
        if (!payload?.episodeId) return;

        if (payload.status === "CANCELLED") {
          const canceled = payload.episodeId;
          set((state) => {
            const copy = { ...state.activeDownloads };
            delete copy[canceled];
            return { activeDownloads: copy };
          });
          return;
        }

        set((state) => ({
          activeDownloads: { ...state.activeDownloads, [payload.episodeId]: payload },
          isWidgetVisible: true,
        }));

        if (payload.status === "COMPLETED") get().fetchDownloadedEpisodes();
      });
    } catch (err) {
      console.error("Failed to listen to download progress:", err);
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
        console.error("Failed to cancel download:", err);
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

  notifyFailure: ({ episodeId, releaseId, episodeOrdinal, message }) => {
    set((state) => ({
      isWidgetVisible: true,
      activeDownloads: {
        ...state.activeDownloads,
        [episodeId]: {
          episodeId,
          releaseId,
          episodeOrdinal,
          totalSegments: 0,
          downloadedSegments: 0,
          downloadedBytes: 0,
          speed: 0,
          percent: 0,
          status: "FAILED",
          error: message,
        },
      },
    }));
  },

  retryDownload: async (meta, m3u8Url) => {
    if (!m3u8Url) {
      get().notifyFailure({
        episodeId: meta.episode_id,
        releaseId: meta.release_id,
        episodeOrdinal: meta.episode_ordinal,
        message: "Поток для скачивания не найден",
      });
      return;
    }
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    try {
      await invoke("downloader_start_episode", {
        releaseId: meta.release_id,
        episode: {
          episodeId: meta.episode_id,
          ordinal: meta.episode_ordinal,
          m3u8Url,
          quality: meta.quality || "1080p",
          opStart: meta.opening_start ?? null,
          opStop: meta.opening_stop ?? null,
          edStart: meta.ending_start ?? null,
          edStop: meta.ending_stop ?? null,
        },
      });
      await get().fetchDownloadedEpisodes();
    } catch (err) {
      console.error("Failed to resume download:", err);
      get().notifyFailure({
        episodeId: meta.episode_id,
        releaseId: meta.release_id,
        episodeOrdinal: meta.episode_ordinal,
        message: `Ошибка при запуске загрузки: ${err}`,
      });
    }
  },
}));
