import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { API_BASE_URL } from "../lib/constants";
import type {
  BookmarkCategory,
  BookmarkItem,
  EpisodeItem,
  GenreItem,
  HistoryItem,
  Release,
} from "../types";

interface CatalogState {
  activeScreen: "home" | "bookmarks" | "details" | "genre" | "downloads";
  selectedRelease: Release | null;
  selectedGenre: GenreItem | null;
  genreReleases: Release[];
  isLoadingGenre: boolean;
  searchQuery: string;
  searchResults: Release[];
  latestReleases: Release[];
  genres: GenreItem[];
  history: HistoryItem[];
  cachedReleases: Record<number, Release>;
  bookmarks: Record<BookmarkCategory, BookmarkItem[]>;
  isSearching: boolean;
  isLoading: boolean;

  // Actions
  setActiveScreen: (screen: "home" | "bookmarks" | "details" | "genre" | "downloads") => void;
  setSelectedRelease: (release: Release | null) => void;
  selectReleaseWithDetails: (release: Release) => Promise<void>;
  selectGenre: (genre: GenreItem | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
  loadGenres: () => Promise<void>;
  fetchAllBookmarks: () => Promise<void>;
  cacheReleases: (releases: Release[]) => void;
  fetchReleaseDetails: (releaseId: number) => Promise<Release | null>;
  saveWatchProgress: (
    release: Release,
    episode: EpisodeItem,
    position: number,
    duration: number,
  ) => Promise<void>;
  setBookmark: (releaseId: number, category: BookmarkCategory, release: Release) => Promise<void>;
  removeBookmark: (releaseId: number) => Promise<void>;
  setEpisodeWatched: (
    releaseId: number,
    episodeId: string,
    episodeOrdinal: number,
    isCompleted: boolean,
  ) => Promise<void>;
}

const INITIAL_BOOKMARKS: Record<BookmarkCategory, BookmarkItem[]> = {
  WATCHING: [],
  PLANNED: [],
  POSTPONED: [],
  ABANDONED: [],
  NOT_INTERESTED: [],
  FAVORITES: [],
  WATCHED: [],
};

function getInitialCachedReleases(): Record<number, Release> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("aniplayer_cached_releases");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  activeScreen: "home",
  selectedRelease: null,
  selectedGenre: null,
  genreReleases: [],
  isLoadingGenre: false,
  searchQuery: "",
  searchResults: [],
  latestReleases: [],
  genres: [],
  history: [],
  cachedReleases: getInitialCachedReleases(),
  bookmarks: INITIAL_BOOKMARKS,
  isSearching: false,
  isLoading: false,

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setSelectedRelease: (release) => set({ selectedRelease: release }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectGenre: async (genre: GenreItem | null) => {
    if (!genre) {
      set({ selectedGenre: null, genreReleases: [], activeScreen: "home" });
      return;
    }
    set({ selectedGenre: genre, genreReleases: [], isLoadingGenre: true, activeScreen: "genre" });
    try {
      let releases: Release[] = [];
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          releases = await invoke<Release[]>("api_get_genre_releases", { genreId: genre.id });
        } catch (err) {
          console.warn("Tauri api_get_genre_releases failed, falling back to fetch:", err);
          const res = await fetch(`${API_BASE_URL}/anime/genres/${genre.id}/releases?limit=30`);
          if (res.ok) {
            const data = await res.json();
            releases = Array.isArray(data) ? data : data.data || [];
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/genres/${genre.id}/releases?limit=30`);
        if (res.ok) {
          const data = await res.json();
          releases = Array.isArray(data) ? data : data.data || [];
        }
      }
      set({ genreReleases: releases, isLoadingGenre: false });
    } catch (e) {
      console.error("Failed to load genre releases:", e);
      set({ isLoadingGenre: false });
    }
  },

  selectReleaseWithDetails: async (release: Release) => {
    set({ selectedRelease: release, activeScreen: "details", isLoading: true });
    try {
      let fullRelease = release;
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          fullRelease = await invoke<Release>("api_get_release", {
            idOrAlias: String(release.id),
          });
        } catch (err) {
          console.warn("Tauri api_get_release failed, falling back to fetch:", err);
          const res = await fetch(`${API_BASE_URL}/anime/releases/${release.id}`);
          if (res.ok) {
            fullRelease = await res.json();
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/releases/${release.id}`);
        if (res.ok) {
          fullRelease = await res.json();
        }
      }
      set({ selectedRelease: fullRelease, isLoading: false });
    } catch (e) {
      console.error("Failed to load release details:", e);
      set({ isLoading: false });
    }
  },

  loadGenres: async () => {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const genres = await invoke<GenreItem[]>("api_get_genres");
          set({ genres });
        } catch (err) {
          console.warn("Tauri api_get_genres failed, falling back to fetch:", err);
          const res = await fetch(`${API_BASE_URL}/anime/genres`);
          if (res.ok) {
            const genres = await res.json();
            set({ genres });
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/genres`);
        if (res.ok) {
          const genres = await res.json();
          set({ genres });
        }
      }
    } catch (e) {
      console.error("Failed to load genres:", e);
    }
  },

  performSearch: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      let results: Release[] = [];
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          results = await invoke<Release[]>("api_search_releases", { query });
        } catch (err) {
          console.warn("Tauri api_search_releases failed, falling back to fetch:", err);
          const res = await fetch(
            `${API_BASE_URL}/app/search/releases?query=${encodeURIComponent(query)}`,
          );
          if (res.ok) {
            results = await res.json();
          }
        }
      } else {
        const res = await fetch(
          `${API_BASE_URL}/app/search/releases?query=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          results = await res.json();
        }
      }
      set({ searchResults: results, isSearching: false });
    } catch (e) {
      console.error("Search failed:", e);
      set({ searchResults: [], isSearching: false });
    }
  },

  cacheReleases: (releases: Release[]) => {
    if (!releases || releases.length === 0) return;
    set((state) => {
      const updated = { ...state.cachedReleases };
      for (const r of releases) {
        if (r && r.id) {
          updated[r.id] = { ...updated[r.id], ...r };
        }
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("aniplayer_cached_releases", JSON.stringify(updated));
        } catch {
          // ignore quota limits
        }
      }
      return { cachedReleases: updated };
    });
  },

  fetchReleaseDetails: async (releaseId: number): Promise<Release | null> => {
    const cached = get().cachedReleases[releaseId];
    if (cached?.episodes && cached.episodes.length > 0) {
      return cached;
    }

    try {
      let fullRelease: Release | null = null;
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          fullRelease = await invoke<Release>("api_get_release", {
            idOrAlias: String(releaseId),
          });
        } catch {
          const res = await fetch(`${API_BASE_URL}/anime/releases/${releaseId}`);
          if (res.ok) fullRelease = await res.json();
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/releases/${releaseId}`);
        if (res.ok) fullRelease = await res.json();
      }
      if (fullRelease) {
        get().cacheReleases([fullRelease]);
        return fullRelease;
      }
    } catch (e) {
      console.error("Failed to fetch release details for id", releaseId, e);
    }
    return cached || null;
  },

  saveWatchProgress: async (
    release: Release,
    episode: EpisodeItem,
    position: number,
    duration: number,
  ) => {
    const isCompleted = duration > 0 && position / duration >= 0.9;
    const item: HistoryItem = {
      release_id: release.id,
      episode_id: episode.id,
      episode_ordinal: episode.ordinal,
      last_position: Math.max(0, Math.round(position)),
      duration: Math.max(0, Math.round(duration)),
      is_completed: isCompleted,
    };

    get().cacheReleases([release]);

    set((state) => {
      const existing = state.history.filter(
        (h) => !(h.release_id === release.id && h.episode_id === episode.id),
      );
      return { history: [item, ...existing] };
    });

    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("db_save_history", { item });
      }
    } catch (e) {
      console.error("Failed to update watch progress:", e);
    }
  },

  fetchAllBookmarks: async () => {
    try {
      let bms: BookmarkItem[] = [];
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        bms = await invoke<BookmarkItem[]>("db_get_bookmarks", { category: null });
      } else if (typeof window !== "undefined") {
        const raw = localStorage.getItem("aniplayer_bookmarks");
        bms = raw ? JSON.parse(raw) : [];
      }

      const grouped: Record<BookmarkCategory, BookmarkItem[]> = {
        WATCHING: [],
        PLANNED: [],
        POSTPONED: [],
        ABANDONED: [],
        NOT_INTERESTED: [],
        FAVORITES: [],
        WATCHED: [],
      };
      const bookmarkReleases: Release[] = [];
      for (const b of bms) {
        if (grouped[b.category]) {
          grouped[b.category].push(b);
        }
        if (b.release_data_json) {
          try {
            bookmarkReleases.push(JSON.parse(b.release_data_json));
          } catch {
            // ignore JSON parse error
          }
        }
      }
      if (bookmarkReleases.length > 0) {
        get().cacheReleases(bookmarkReleases);
      }
      set({ bookmarks: grouped });
    } catch (e) {
      console.error("Failed to load bookmarks:", e);
    }
  },

  loadInitialData: async () => {
    set({ isLoading: true });
    try {
      let latest: Release[] = [];
      let historyItems: HistoryItem[] = [];

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          latest = await invoke<Release[]>("api_get_latest_releases", { limit: 24 });
        } catch (err) {
          console.warn("Tauri api_get_latest_releases failed, falling back to fetch:", err);
          const res = await fetch(`${API_BASE_URL}/anime/releases/latest?limit=24`);
          if (res.ok) {
            latest = await res.json();
          }
        }
        historyItems = await invoke<HistoryItem[]>("db_get_all_history").catch(() => []);
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/releases/latest?limit=24`);
        if (res.ok) {
          latest = await res.json();
        }
      }

      if (latest.length > 0) {
        get().cacheReleases(latest);
      }

      set({
        latestReleases: latest,
        history: historyItems,
        isLoading: false,
      });
      await Promise.all([get().fetchAllBookmarks(), get().loadGenres()]);

      // Asynchronously fetch release details for recent history items missing from cache
      for (const h of historyItems.slice(0, 10)) {
        if (!get().cachedReleases[h.release_id]) {
          get().fetchReleaseDetails(h.release_id);
        }
      }
    } catch (e) {
      console.error("Failed to load initial data:", e);
      set({ isLoading: false });
    }
  },

  setBookmark: async (releaseId, category, release) => {
    const item: BookmarkItem = {
      release_id: releaseId,
      category,
      release_data_json: JSON.stringify(release),
    };
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("db_save_bookmark", { item });
      } else if (typeof window !== "undefined") {
        const raw = localStorage.getItem("aniplayer_bookmarks");
        const list: BookmarkItem[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter((b) => b.release_id !== releaseId);
        filtered.push(item);
        localStorage.setItem("aniplayer_bookmarks", JSON.stringify(filtered));
      }
      await get().fetchAllBookmarks();
    } catch (e) {
      console.error("Failed to save bookmark:", e);
    }
  },

  removeBookmark: async (releaseId) => {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("db_delete_bookmark", { releaseId });
      } else if (typeof window !== "undefined") {
        const raw = localStorage.getItem("aniplayer_bookmarks");
        const list: BookmarkItem[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter((b) => b.release_id !== releaseId);
        localStorage.setItem("aniplayer_bookmarks", JSON.stringify(filtered));
      }
      await get().fetchAllBookmarks();
    } catch (e) {
      console.error("Failed to remove bookmark:", e);
    }
  },

  setEpisodeWatched: async (releaseId, episodeId, episodeOrdinal, isCompleted) => {
    const item: HistoryItem = {
      release_id: releaseId,
      episode_id: episodeId,
      episode_ordinal: episodeOrdinal,
      last_position: isCompleted ? 1440 : 0,
      duration: 1440,
      is_completed: isCompleted,
    };

    // Optimistically update store history immediately
    set((state) => {
      const existing = state.history.filter(
        (h) => !(h.release_id === releaseId && h.episode_id === episodeId),
      );
      return { history: [item, ...existing] };
    });

    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("db_save_history", { item });
        const historyItems = await invoke<HistoryItem[]>("db_get_all_history").catch(() => []);
        set({ history: historyItems });
      }
    } catch (e) {
      console.error("Failed to update history:", e);
    }
  },
}));
