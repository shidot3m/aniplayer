import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { BookmarkCategory, BookmarkItem, HistoryItem, Release } from "../types";

interface CatalogState {
  activeScreen: "home" | "bookmarks" | "details";
  selectedRelease: Release | null;
  searchQuery: string;
  searchResults: Release[];
  latestReleases: Release[];
  history: HistoryItem[];
  bookmarks: Record<BookmarkCategory, BookmarkItem[]>;
  isSearching: boolean;
  isLoading: boolean;

  // Actions
  setActiveScreen: (screen: "home" | "bookmarks" | "details") => void;
  setSelectedRelease: (release: Release | null) => void;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
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
  searchQuery: "",
  searchResults: [],
  latestReleases: [],
  history: [],
  bookmarks: INITIAL_BOOKMARKS,
  isSearching: false,
  isLoading: false,

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setSelectedRelease: (release) => set({ selectedRelease: release }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  performSearch: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await invoke<Release[]>("api_search_releases", { query });
      set({ searchResults: results, isSearching: false });
    } catch (e) {
      console.error("Search failed:", e);
      set({ searchResults: [], isSearching: false });
    }
  },

  fetchAllBookmarks: async () => {
    try {
      const bms = await invoke<BookmarkItem[]>("db_get_bookmarks", {
        category: null,
      });
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
      const latest = await invoke<Release[]>("api_get_latest_releases", {
        limit: 24,
      });
      const historyItems = await invoke<HistoryItem[]>("db_get_history", {
        limit: 20,
      });
      set({
        latestReleases: latest,
        history: historyItems,
        isLoading: false,
      });
      await get().fetchAllBookmarks();
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
      await invoke("db_set_bookmark", { item });
      await get().fetchAllBookmarks();
    } catch (e) {
      console.error("Failed to save bookmark:", e);
    }
  },

  removeBookmark: async (releaseId) => {
    try {
      await invoke("db_remove_bookmark", { releaseId });
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
      await invoke("db_update_history", { item });
      const historyItems = await invoke<HistoryItem[]>("db_get_history", {
        limit: 20,
      });
      set({ history: historyItems });
    } catch (e) {
      console.error("Failed to update history:", e);
    }
  },
}));
