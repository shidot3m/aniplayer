import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogStore } from "@/features/catalog";
import { ContinueWatching } from "@/features/continue-watching";
import { usePlayerStore } from "@/features/player";
import type { HistoryItem, Release } from "@/shared/types";

const mockRelease: Release = {
  id: 2001,
  name: {
    main: "Тестовый тайтл",
    english: "Test Release",
    alternative: "テスト",
  },
  type: { value: "tv", description: "ТВ" },
  year: 2025,
  season: { value: "winter", description: "Зима" },
  poster: { src: "/poster.jpg", preview: "/preview.jpg", thumbnail: "/thumb.jpg" },
  description: "Тестовое описание",
  episodes_total: 3,
  average_duration_of_episode: 24,
  genres: [{ id: 1, name: "Экшен" }],
  episodes: [
    { id: "ep-1", name: "Серия 1", ordinal: 1, hls_1080: "https://stream/ep1.m3u8" },
    { id: "ep-2", name: "Серия 2", ordinal: 2, hls_1080: "https://stream/ep2.m3u8" },
    { id: "ep-3", name: "Серия 3", ordinal: 3, hls_1080: "https://stream/ep3.m3u8" },
  ],
};

const episode2 = mockRelease.episodes[1];

function baseHistoryItem(overrides: Partial<HistoryItem>): HistoryItem {
  return {
    release_id: mockRelease.id,
    episode_id: "ep-2",
    episode_ordinal: 2,
    last_position: 0,
    duration: 2924,
    is_completed: false,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("ContinueWatching resume position", () => {
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
      cachedReleases: { [mockRelease.id]: mockRelease },
      latestReleases: [mockRelease],
    });
  });

  it("resumes an in-progress episode at the saved position", () => {
    useCatalogStore.setState({ history: [baseHistoryItem({ last_position: 76 })] });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    render(<ContinueWatching />);
    fireEvent.click(screen.getByRole("button", { name: /Продолжить/ }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode2, 76);
  });

  it("starts the next unwatched episode from the beginning", () => {
    useCatalogStore.setState({
      history: [
        baseHistoryItem({
          episode_id: "ep-1",
          episode_ordinal: 1,
          last_position: 2924,
          is_completed: true,
        }),
      ],
    });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    render(<ContinueWatching />);
    fireEvent.click(screen.getByRole("button", { name: /Начать серию/ }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode2, 0);
  });
});
