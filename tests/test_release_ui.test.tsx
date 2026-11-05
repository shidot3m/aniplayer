import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogStore } from "@/features/catalog";
import { ReleaseDetails } from "@/features/release";
import type { FranchiseItem, Release } from "@/shared/types";

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 4001,
    name: { main: "Киберпанк: Бегущие по краю 2", english: "Cyberpunk: Edgerunners 2" },
    type: { value: "ona", description: "ONA" },
    year: 2026,
    poster: { src: "/poster.jpg", preview: "/preview.jpg", thumbnail: "/thumb.jpg" },
    description: "В мире будущего технологии и импланты стали частью выживания.",
    episodes_total: 8,
    average_duration_of_episode: 24,
    genres: [
      { id: 1, name: "Фантастика" },
      { id: 2, name: "Экшен" },
    ],
    episodes: [
      { id: "e1", ordinal: 1, name: "Прощание с хромом", duration: 2832 },
      { id: "e2", ordinal: 2, name: "Кочевник", duration: 2808 },
    ],
    ...overrides,
  } as Release;
}

const release = makeRelease();

describe("Release page", () => {
  beforeEach(() => {
    useCatalogStore.setState({
      history: [],
      bookmarks: {
        WATCHING: [],
        PLANNED: [],
        POSTPONED: [],
        ABANDONED: [],
        NOT_INTERESTED: [],
        FAVORITES: [],
        WATCHED: [],
      },
      cachedReleases: { [release.id]: release },
      latestReleases: [release],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the hero in the catalog language: title, genres, actions — no badges", () => {
    render(<ReleaseDetails release={release} onBack={() => {}} />);

    expect(screen.getByRole("heading", { name: "Киберпанк: Бегущие по краю 2" })).toBeDefined();
    // original name is present, not only the Russian title
    expect(screen.getByText("Cyberpunk: Edgerunners 2")).toBeDefined();
    // genres are quiet text, and there are no tinted plates
    expect(screen.getByText("Фантастика · Экшен")).toBeDefined();
    expect(screen.getByRole("button", { name: "В закладки" })).toBeDefined();
    expect(screen.queryByText(/просмотрено/i)).toBeNull();
  });

  it("lists episodes as rows with a tabular ordinal and a duration timecode", () => {
    render(<ReleaseDetails release={release} onBack={() => {}} />);

    expect(screen.getByRole("heading", { name: "Эпизоды" })).toBeDefined();
    expect(screen.getByText("Прощание с хромом")).toBeDefined();
    // 2832s → 47:12
    expect(screen.getByText("47:12")).toBeDefined();
    expect(screen.getByRole("button", { name: "Воспроизвести эпизод 1" })).toBeDefined();
  });

  it("shows the franchise in chronological order with the current release marked", async () => {
    const prior = makeRelease({ id: 4000, name: { main: "Киберпанк: Бегущие по краю" } });
    const franchises: FranchiseItem[] = [
      {
        id: "f1",
        name: "Киберпанк",
        franchise_releases: [
          { id: "r2", sort_order: 2, release_id: release.id, release },
          { id: "r1", sort_order: 1, release_id: prior.id, release: prior },
        ],
      },
    ];
    const selectSpy = vi.fn();
    useCatalogStore.setState({ selectReleaseWithDetails: selectSpy });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => franchises } as Response),
    );

    render(<ReleaseDetails release={release} onBack={() => {}} />);

    await screen.findByText("Связанное");

    // the rail is ordered by sort_order, and the numbers are positions in the franchise
    expect(
      screen.getByRole("button", { name: "Открыть Киберпанк: Бегущие по краю" }),
    ).toBeDefined();
    // the current release is marked with text, never a badge
    expect(screen.getByText("Сейчас смотрите")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Открыть Киберпанк: Бегущие по краю" }));
    await waitFor(() => expect(selectSpy).toHaveBeenCalled());
  });
});
