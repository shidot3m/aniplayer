import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogStore } from "@/features/catalog";
import { usePlayerStore } from "@/features/player";
import { ReleaseDetails } from "@/features/release";
import type { HistoryItem, Release } from "@/shared/types";

const mockRelease: Release = {
  id: 3001,
  name: {
    main: "Тестовый сериал",
    english: "Test Series",
    alternative: "テストシリーズ",
  },
  type: { value: "tv", description: "ТВ" },
  year: 2025,
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
const episode3 = mockRelease.episodes[2];

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

function renderDetails() {
  return render(<ReleaseDetails release={mockRelease} onBack={() => {}} />);
}

describe("ReleaseDetails resume position", () => {
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

  it("resumes the hero play button at the saved position", () => {
    useCatalogStore.setState({ history: [baseHistoryItem({ last_position: 76 })] });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Продолжить с 2 эпизода" }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode2, 76);
  });

  it("resumes an in-progress episode clicked in the grid at the saved position", () => {
    useCatalogStore.setState({ history: [baseHistoryItem({ last_position: 76 })] });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Воспроизвести эпизод 2" }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode2, 76);
  });

  it("starts a completed episode from the beginning", () => {
    useCatalogStore.setState({
      history: [baseHistoryItem({ last_position: 2924, is_completed: true })],
    });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Воспроизвести эпизод 2" }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode2, 0);
  });

  it("starts an unwatched episode from the beginning", () => {
    useCatalogStore.setState({ history: [baseHistoryItem({ last_position: 76 })] });
    const playEpisode = vi.fn().mockResolvedValue(undefined);
    usePlayerStore.setState({ playEpisode });

    renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Воспроизвести эпизод 3" }));

    expect(playEpisode).toHaveBeenCalledWith(mockRelease, episode3, 0);
  });
});
