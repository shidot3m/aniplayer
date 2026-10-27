import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { API_BASE_URL } from "../shared/lib/constants";
import type {
  BookmarkCategory,
  BookmarkItem,
  EpisodeItem,
  GenreItem,
  HistoryItem,
  Release,
} from "../shared/types";
import {
  deleteBrowserBookmark,
  getBrowserBookmarks,
  getInitialCachedReleases,
  groupBookmarks,
  INITIAL_BOOKMARKS,
  saveCachedReleases,
  upsertBrowserBookmark,
} from "./catalogCache";
import {
  beginGenreRequest,
  fetchGenreReleasesPage,
  GENRE_PAGE_SIZE,
  invalidateGenreRequests,
  isLatestGenreRequest,
} from "./genreApi";

interface CatalogState {
  activeScreen: "home" | "bookmarks" | "details" | "genre" | "downloads";
  selectedRelease: Release | null;
  selectedGenre: GenreItem | null;
  genreReleases: Release[];
  genrePage: number;
  genreTotalPages: number;
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
  loadGenrePage: (page: number) => Promise<void>;
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

export const useCatalogStore = create<CatalogState>((set, get) => ({
  activeScreen: "home",
  selectedRelease: null,
  selectedGenre: null,
  genreReleases: [],
  genrePage: 1,
  genreTotalPages: 1,
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
      invalidateGenreRequests();
      set({
        selectedGenre: null,
        genreReleases: [],
        genrePage: 1,
        genreTotalPages: 1,
        isLoadingGenre: false,
        activeScreen: "home",
      });
      return;
    }
    set({
      selectedGenre: genre,
      genreReleases: [],
      genrePage: 1,
      genreTotalPages: 1,
      activeScreen: "genre",
    });
    await get().loadGenrePage(1);
  },

  loadGenrePage: async (page: number) => {
    const genre = get().selectedGenre;
    if (!genre) return;

    const previousPage = get().genrePage;
    const requestId = beginGenreRequest();
    set({ genrePage: page, isLoadingGenre: true });

    try {
      const result = await fetchGenreReleasesPage(genre.id, page, GENRE_PAGE_SIZE);
      if (!isLatestGenreRequest(requestId)) return;
      set({
        genreReleases: result.releases,
        genrePage: Math.max(1, result.pagination.current_page),
        genreTotalPages: Math.max(1, result.pagination.total_pages),
        isLoadingGenre: false,
      });
    } catch (e) {
      if (!isLatestGenreRequest(requestId)) return;
      console.error("Failed to load genre releases:", e);
      set({ genrePage: previousPage, isLoadingGenre: false });
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
        if (r?.id) {
          updated[r.id] = { ...updated[r.id], ...r };
        }
      }
      saveCachedReleases(updated);
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
        bms = getBrowserBookmarks();
      }

      const { grouped, releases } = groupBookmarks(bms);
      if (releases.length > 0) {
        get().cacheReleases(releases);
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
        upsertBrowserBookmark(item);
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
        deleteBrowserBookmark(releaseId);
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
