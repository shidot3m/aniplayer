import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type {
  BookmarkCategory,
  BookmarkItem,
  HistoryItem,
  ReleaseDetails,
  ReleasePreview,
} from "../types";

interface CatalogState {
  activeView: "home" | "bookmarks" | "details" | "genre";
  selectedReleaseId: number | null;
  selectedRelease: ReleaseDetails | null;
  selectedGenreId: number | null;
  selectedGenreName: string | null;
  searchQuery: string;
  searchResults: ReleasePreview[];
  latestReleases: ReleasePreview[];
  continueWatching: HistoryItem[];
  bookmarks: BookmarkItem[];
  activeBookmarkCategory: BookmarkCategory;
  isLoading: boolean;

  // Actions
  navigateToHome: () => void;
  navigateToDetails: (releaseId: number) => Promise<void>;
  navigateToBookmarks: (category?: BookmarkCategory) => Promise<void>;
  navigateToGenre: (genreId: number, genreName: string) => void;
  setSearchQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  fetchHomeData: () => Promise<void>;
  fetchBookmarks: (category?: BookmarkCategory) => Promise<void>;
  setBookmark: (
    release: ReleasePreview | ReleaseDetails,
    category: BookmarkCategory,
  ) => Promise<void>;
  deleteBookmark: (releaseId: number) => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  activeView: "home",
  selectedReleaseId: null,
  selectedRelease: null,
  selectedGenreId: null,
  selectedGenreName: null,
  searchQuery: "",
  searchResults: [],
  latestReleases: [],
  continueWatching: [],
  bookmarks: [],
  activeBookmarkCategory: "WATCHING",
  isLoading: false,

  navigateToHome: () => {
    set({ activeView: "home", searchQuery: "", searchResults: [] });
    get().fetchHomeData();
  },

  navigateToDetails: async (releaseId: number) => {
    set({ activeView: "details", selectedReleaseId: releaseId, isLoading: true });
    try {
      const details = await invoke<ReleaseDetails>("api_get_release", {
        idOrAlias: releaseId.toString(),
      });
      set({ selectedRelease: details, isLoading: false });
    } catch (e) {
      console.error("Failed to load release details:", e);
      set({ isLoading: false });
    }
  },

  navigateToBookmarks: async (category = "WATCHING") => {
    set({ activeView: "bookmarks", activeBookmarkCategory: category });
    await get().fetchBookmarks(category);
  },

  navigateToGenre: (genreId: number, genreName: string) => {
    set({
      activeView: "genre",
      selectedGenreId: genreId,
      selectedGenreName: genreName,
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
    }
  },

  search: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    set({ isLoading: true });
    try {
      const results = await invoke<ReleasePreview[]>("api_search_releases", { query });
      set({ searchResults: results, isLoading: false });
    } catch (e) {
      console.error("Search failed:", e);
      set({ searchResults: [], isLoading: false });
    }
  },

  fetchHomeData: async () => {
    set({ isLoading: true });
    try {
      const latest = await invoke<ReleasePreview[]>("api_get_latest_releases", { limit: 24 });
      const continueWatching = await invoke<HistoryItem[]>("db_get_continue_watching");
      set({
        latestReleases: latest,
        continueWatching: continueWatching,
        isLoading: false,
      });
    } catch (e) {
      console.error("Failed to fetch home data:", e);
      set({ isLoading: false });
    }
  },

  fetchBookmarks: async (category?: BookmarkCategory) => {
    try {
      const bms = await invoke<BookmarkItem[]>("db_get_bookmarks", {
        category: category || null,
      });
      set({ bookmarks: bms });
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    }
  },

  setBookmark: async (release, category) => {
    const item: BookmarkItem = {
      release_id: release.id,
      category,
      release_data_json: JSON.stringify({
        id: release.id,
        name: release.name,
        type: release.type,
        year: release.year,
        episodes_total: release.episodes_total,
        poster: release.poster,
      }),
    };
    try {
      await invoke("db_save_bookmark", { item });
      await get().fetchBookmarks(get().activeBookmarkCategory);
    } catch (e) {
      console.error("Failed to save bookmark:", e);
    }
  },

  deleteBookmark: async (releaseId: number) => {
    try {
      await invoke("db_delete_bookmark", { releaseId });
      await get().fetchBookmarks(get().activeBookmarkCategory);
    } catch (e) {
      console.error("Failed to delete bookmark:", e);
    }
  },
}));
