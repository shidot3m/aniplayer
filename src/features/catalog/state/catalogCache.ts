import type { BookmarkCategory, BookmarkItem, Release } from "@/shared/types";

export function createEmptyBookmarks(): Record<BookmarkCategory, BookmarkItem[]> {
  return {
    WATCHING: [],
    PLANNED: [],
    POSTPONED: [],
    ABANDONED: [],
    NOT_INTERESTED: [],
    FAVORITES: [],
    WATCHED: [],
  };
}

export const INITIAL_BOOKMARKS = createEmptyBookmarks();

export function getInitialCachedReleases(): Record<number, Release> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("aniplayer_cached_releases");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCachedReleases(releases: Record<number, Release>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("aniplayer_cached_releases", JSON.stringify(releases));
  } catch {
    // ignore quota limits
  }
}

export function getBrowserBookmarks(): BookmarkItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("aniplayer_bookmarks");
  return raw ? JSON.parse(raw) : [];
}

export function upsertBrowserBookmark(item: BookmarkItem): void {
  const list = getBrowserBookmarks().filter((bookmark) => bookmark.release_id !== item.release_id);
  list.push(item);
  localStorage.setItem("aniplayer_bookmarks", JSON.stringify(list));
}

export function deleteBrowserBookmark(releaseId: number): void {
  const list = getBrowserBookmarks().filter((bookmark) => bookmark.release_id !== releaseId);
  localStorage.setItem("aniplayer_bookmarks", JSON.stringify(list));
}

export function groupBookmarks(bookmarks: BookmarkItem[]): {
  grouped: Record<BookmarkCategory, BookmarkItem[]>;
  releases: Release[];
} {
  const grouped = createEmptyBookmarks();
  const releases: Release[] = [];
  for (const bookmark of bookmarks) {
    if (grouped[bookmark.category]) {
      grouped[bookmark.category].push(bookmark);
    }
    if (bookmark.release_data_json) {
      try {
        releases.push(JSON.parse(bookmark.release_data_json));
      } catch {
        // ignore malformed cached release payloads
      }
    }
  }
  return { grouped, releases };
}
