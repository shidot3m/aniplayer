import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GenreView } from "../src/components/GenreView";
import { API_BASE_URL } from "../src/lib/constants";
import { useCatalogStore } from "../src/store/catalogStore";
import type { GenreItem, Release } from "../src/types";

const GENRE: GenreItem = { id: 21, name: "Комедия", total_releases: 45 };

function makeRelease(id: number): Release {
  return {
    id,
    name: { main: `Релиз ${id}` },
    episodes: [],
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const initialState = useCatalogStore.getState();

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  useCatalogStore.setState(initialState, true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("catalogStore genre pagination", () => {
  it("loads the first page with pagination metadata when a genre is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [makeRelease(101)],
        meta: {
          pagination: {
            total: 45,
            count: 1,
            per_page: 30,
            current_page: 1,
            total_pages: 2,
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await useCatalogStore.getState().selectGenre(GENRE);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/anime/genres/21/releases?page=1&limit=30`,
    );
    const state = useCatalogStore.getState();
    expect(state.genreReleases.map((release) => release.id)).toEqual([101]);
    expect(state.genrePage).toBe(1);
    expect(state.genreTotalPages).toBe(2);
    expect(state.isLoadingGenre).toBe(false);
  });

  it("loads a specific page and replaces the visible releases", async () => {
    useCatalogStore.setState({ selectedGenre: GENRE, genrePage: 1, genreTotalPages: 2 });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [makeRelease(201)],
        meta: {
          pagination: {
            total: 45,
            count: 1,
            per_page: 30,
            current_page: 2,
            total_pages: 2,
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await useCatalogStore.getState().loadGenrePage(2);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/anime/genres/21/releases?page=2&limit=30`,
    );
    const state = useCatalogStore.getState();
    expect(state.genreReleases.map((release) => release.id)).toEqual([201]);
    expect(state.genrePage).toBe(2);
    expect(state.genreTotalPages).toBe(2);
    expect(state.isLoadingGenre).toBe(false);
  });

  it("ignores a stale page response after switching genres", async () => {
    let resolveFirstPage: (response: Response) => void = () => {};
    const firstPage = new Promise<Response>((resolve) => {
      resolveFirstPage = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstPage)
      .mockResolvedValueOnce(
        jsonResponse({
          data: [makeRelease(301)],
          meta: {
            pagination: {
              total: 10,
              count: 1,
              per_page: 30,
              current_page: 1,
              total_pages: 1,
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const firstLoad = useCatalogStore.getState().selectGenre(GENRE);
    await useCatalogStore.getState().selectGenre({ id: 22, name: "Драма" });
    resolveFirstPage(
      jsonResponse({
        data: [makeRelease(101)],
        meta: {
          pagination: {
            total: 45,
            count: 1,
            per_page: 30,
            current_page: 1,
            total_pages: 2,
          },
        },
      }),
    );
    await firstLoad;

    const state = useCatalogStore.getState();
    expect(state.selectedGenre?.id).toBe(22);
    expect(state.genreReleases.map((release) => release.id)).toEqual([301]);
  });
});

describe("GenreView pagination", () => {
  it("navigates between pages and exposes the current page state", async () => {
    useCatalogStore.setState({
      selectedGenre: GENRE,
      genres: [GENRE],
      genreReleases: [makeRelease(101)],
      genrePage: 1,
      genreTotalPages: 3,
      isLoadingGenre: false,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [makeRelease(201)],
        meta: {
          pagination: {
            total: 65,
            count: 1,
            per_page: 30,
            current_page: 2,
            total_pages: 3,
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GenreView genre={GENRE} onSelectRelease={() => {}} onBack={() => {}} />);

    const previousButton = screen.getByRole("button", { name: "Предыдущая страница" });
    expect((previousButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Страница 1 из 3")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Страница 2" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Открыть Релиз 201" })).toBeDefined();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/anime/genres/21/releases?page=2&limit=30`,
    );
    expect(useCatalogStore.getState().genrePage).toBe(2);
    expect(screen.getByText("Страница 2 из 3")).toBeDefined();
    expect(screen.getByRole("button", { name: "Страница 2" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("shows edge pages and an ellipsis for long genres", () => {
    useCatalogStore.setState({
      selectedGenre: GENRE,
      genres: [GENRE],
      genreReleases: [makeRelease(101)],
      genrePage: 1,
      genreTotalPages: 57,
      isLoadingGenre: false,
    });

    render(<GenreView genre={GENRE} onSelectRelease={() => {}} onBack={() => {}} />);

    expect(screen.getByText("Страница 1 из 57")).toBeDefined();
    expect(screen.getByRole("button", { name: "Страница 2" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Страница 57" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Страница 3" })).toBeNull();
    expect(screen.getByText("…")).toBeDefined();
  });

  it("hides pagination when the genre fits on a single page", () => {
    useCatalogStore.setState({
      selectedGenre: GENRE,
      genres: [GENRE],
      genreReleases: [makeRelease(101)],
      genrePage: 1,
      genreTotalPages: 1,
      isLoadingGenre: false,
    });

    render(<GenreView genre={GENRE} onSelectRelease={() => {}} onBack={() => {}} />);

    expect(screen.queryByRole("navigation", { name: "Страницы жанра" })).toBeNull();
  });
});
