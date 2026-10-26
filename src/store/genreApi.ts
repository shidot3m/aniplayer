import { invoke } from "@tauri-apps/api/core";
import { API_BASE_URL } from "../lib/constants";
import type { GenrePagination, GenreReleasesPage, Release } from "../types";

export const GENRE_PAGE_SIZE = 30;

let requestSeq = 0;

export function beginGenreRequest(): number {
  requestSeq += 1;
  return requestSeq;
}

export function invalidateGenreRequests(): void {
  requestSeq += 1;
}

export function isLatestGenreRequest(requestId: number): boolean {
  return requestId === requestSeq;
}

function parseGenreReleasesResponse(data: unknown, limit: number): GenreReleasesPage {
  const wrapped =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as { data?: Release[]; meta?: { pagination?: Partial<GenrePagination> } })
      : null;
  const releases = Array.isArray(data) ? (data as Release[]) : (wrapped?.data ?? []);
  const pagination = wrapped?.meta?.pagination;
  return {
    releases,
    pagination: {
      total: pagination?.total ?? releases.length,
      count: pagination?.count ?? releases.length,
      per_page: pagination?.per_page ?? limit,
      current_page: pagination?.current_page ?? 1,
      total_pages: pagination?.total_pages ?? 1,
    },
  };
}

export async function fetchGenreReleasesPage(
  genreId: number,
  page: number,
  limit: number,
): Promise<GenreReleasesPage> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      return await invoke<GenreReleasesPage>("api_get_genre_releases", { genreId, page, limit });
    } catch (err) {
      console.warn("Tauri api_get_genre_releases failed, falling back to fetch:", err);
    }
  }

  const res = await fetch(
    `${API_BASE_URL}/anime/genres/${genreId}/releases?page=${page}&limit=${limit}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load genre releases (${res.status})`);
  }
  return parseGenreReleasesResponse(await res.json(), limit);
}
