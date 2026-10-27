import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { DownloadedEpisodeMeta, DownloadProgressEvent } from "../shared/types";

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
  startTorrentDownload: (
    releaseId: number,
    torrentId: number,
    magnetOrUrl: string,
  ) => Promise<void>;
  listenToProgress: () => Promise<() => void>;
  toggleWidgetExpanded: () => void;
  setWidgetExpanded: (expanded: boolean) => void;
  setWidgetVisible: (visible: boolean) => void;
  dismissDownload: (episodeId: string) => void;
  cancelDownload: (episodeId: string) => Promise<void>;
  cancelAllDownloads: () => Promise<void>;
  clearCompletedDownloads: () => void;
}

interface RawDownloadProgressEvent {
  id?: string;
  episodeId?: string;
  release_id?: number;
  releaseId?: number;
  episodeOrdinal?: number;
  ordinal?: number;
  totalSegments?: number;
  downloadedSegments?: number;
  total_bytes?: number;
  totalBytes?: number;
  progress?: number;
  percent?: number;
  status?: DownloadProgressEvent["status"] | "CANCELED";
  error?: string | null;
  speed?: number;
  peers?: number;
  downloaded_bytes?: number;
  downloadedBytes?: number;
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

  startTorrentDownload: async (releaseId: number, torrentId: number, magnetOrUrl: string) => {
    const downloadId = `torrent-${torrentId}`;

    const setStatus = (
      status: "DOWNLOADING" | "FAILED",
      extra: Partial<DownloadProgressEvent> = {},
    ) => {
      set((state) => {
        const existing = state.activeDownloads[downloadId];
        const base: DownloadProgressEvent = existing ?? {
          episodeId: downloadId,
          releaseId,
          episodeOrdinal: 0,
          totalSegments: 0,
          downloadedSegments: 0,
          totalBytes: 0,
          percent: 0,
          speed: 0,
          peers: 0,
          status: "DOWNLOADING",
        };
        return {
          activeDownloads: {
            ...state.activeDownloads,
            [downloadId]: { ...base, status, ...extra },
          },
          isWidgetVisible: true,
        };
      });
    };

    setStatus("DOWNLOADING");

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        await invoke("downloader_start_torrent", {
          releaseId,
          torrentId,
          magnetOrUrl,
        });
      } catch (err) {
        console.error("Failed to start torrent download:", err);
        setStatus("FAILED", { error: String(err) });
      }
    }
  },

  listenToProgress: async () => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return () => {
        // No-op cleanup for non-Tauri browser environment
      };
    }

    try {
      const unlistenProgress = await listen<RawDownloadProgressEvent>(
        "download-progress",
        (event) => {
          const payload = event.payload;
          if (!payload) return;

          const id = payload.id || payload.episodeId;
          if (!id) return;

          const status =
            payload.status === "CANCELED" ? "CANCELLED" : (payload.status ?? "DOWNLOADING");

          if (status === "CANCELLED") {
            set((state) => {
              const copy = { ...state.activeDownloads };
              delete copy[id];
              return { activeDownloads: copy };
            });
            return;
          }

          const normalized: DownloadProgressEvent = {
            episodeId: id,
            releaseId: payload.release_id ?? payload.releaseId ?? 0,
            episodeOrdinal: payload.episodeOrdinal ?? payload.ordinal ?? 0,
            totalSegments: payload.totalSegments ?? 0,
            downloadedSegments: payload.downloadedSegments ?? 0,
            totalBytes: payload.total_bytes ?? payload.totalBytes ?? 0,
            percent: payload.progress ?? payload.percent ?? 0,
            status: status,
            error: payload.error ?? null,
            speed: payload.speed,
            peers: payload.peers,
            downloadedBytes: payload.downloaded_bytes ?? payload.downloadedBytes,
          };

          set((state) => ({
            activeDownloads: {
              ...state.activeDownloads,
              [id]: normalized,
            },
            isWidgetVisible: true,
          }));

          if (status === "COMPLETED") {
            get().fetchDownloadedEpisodes();
          }
        },
      );

      const unlistenUpdated = await listen("downloads-updated", () => {
        get().fetchDownloadedEpisodes();
      });

      return () => {
        unlistenProgress();
        unlistenUpdated();
      };
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
        if (episodeId.startsWith("torrent-")) {
          const torrentId = parseInt(episodeId.replace("torrent-", ""), 10);
          if (!Number.isNaN(torrentId)) {
            await invoke("downloader_cancel_torrent", { torrentId });
          }
        } else {
          await invoke("downloader_cancel_episode", { episodeId });
        }
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
}));
