import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { API_BASE_URL } from "../lib/constants";
import type { BookmarkCategory, BookmarkItem, GenreItem, HistoryItem, Release } from "../types";

interface CatalogState {
  activeScreen: "home" | "bookmarks" | "details" | "genre";
  selectedRelease: Release | null;
  selectedGenre: GenreItem | null;
  genreReleases: Release[];
  isLoadingGenre: boolean;
  searchQuery: string;
  searchResults: Release[];
  latestReleases: Release[];
  genres: GenreItem[];
  history: HistoryItem[];
  bookmarks: Record<BookmarkCategory, BookmarkItem[]>;
  isSearching: boolean;
  isLoading: boolean;

  // Actions
  setActiveScreen: (screen: "home" | "bookmarks" | "details" | "genre") => void;
  setSelectedRelease: (release: Release | null) => void;
  selectReleaseWithDetails: (release: Release) => Promise<void>;
  selectGenre: (genre: GenreItem | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
  loadGenres: () => Promise<void>;
  fetchAllBookmarks: () => Promise<void>;
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
          releases = await invoke<Release[]>("api_get_genre_releases", { genre_id: genre.id });
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
            id_or_alias: String(release.id),
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
      for (const b of bms) {
        if (grouped[b.category]) {
          grouped[b.category].push(b);
        }
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
        historyItems = await invoke<HistoryItem[]>("db_get_continue_watching").catch(() => []);
      } else {
        const res = await fetch(`${API_BASE_URL}/anime/releases/latest?limit=24`);
        if (res.ok) {
          latest = await res.json();
        }
      }

      set({
        latestReleases: latest,
        history: historyItems,
        isLoading: false,
      });
      await Promise.all([get().fetchAllBookmarks(), get().loadGenres()]);
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
        await invoke("db_delete_bookmark", { release_id: releaseId });
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
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("db_save_history", { item });
        const historyItems = await invoke<HistoryItem[]>("db_get_continue_watching").catch(
          () => [],
        );
        set({ history: historyItems });
      }
    } catch (e) {
      console.error("Failed to update history:", e);
    }
  },
}));
