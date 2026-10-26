import type { BookmarkCategory, BookmarkItem, HistoryItem, Release } from "../types";
import { CDN_BASE_URL } from "./constants";

export const CATEGORY_NAMES: Record<BookmarkCategory, string> = {
  WATCHING: "Смотрю",
  PLANNED: "В планах",
  POSTPONED: "Отложено",
  ABANDONED: "Брошено",
  NOT_INTERESTED: "Не интересно",
  FAVORITES: "Любимое",
  WATCHED: "Просмотрено",
};

export function formatPosterUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${CDN_BASE_URL}${cleanPath}`;
}

export function findBookmarkCategory(
  bookmarks: Record<BookmarkCategory, BookmarkItem[]>,
  releaseId: number,
): BookmarkCategory | null {
  for (const [category, items] of Object.entries(bookmarks)) {
    if (items.some((bookmark) => bookmark.release_id === releaseId)) {
      return category as BookmarkCategory;
    }
  }
  return null;
}

export function isReleaseWatched(
  release: Release,
  history: HistoryItem[],
  currentCategory: BookmarkCategory | null,
): boolean {
  return (
    currentCategory === "WATCHED" ||
    Boolean(
      release.episodes?.length &&
        release.episodes.every((episode) =>
          history.some(
            (item) =>
              item.release_id === release.id && item.episode_id === episode.id && item.is_completed,
          ),
        ),
    )
  );
}
