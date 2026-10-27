import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ContinueWatching } from "@/components/ContinueWatching";
import { SettingsMenu } from "@/components/player/SettingsMenu";
import { ReleaseDetails } from "@/components/ReleaseDetails";
import type { HistoryItem, Release } from "@/shared/types";
import { useCatalogStore } from "@/store/catalogStore";

const mockRelease: Release = {
  id: 1001,
  name: {
    main: "Магическая битва",
    english: "Jujutsu Kaisen",
    alternative: "呪術廻戦",
  },
  type: {
    value: "tv",
    description: "ТВ",
  },
  year: 2024,
  season: {
    value: "fall",
    description: "Осень",
  },
  poster: {
    src: "/poster.jpg",
    preview: "/preview.jpg",
    thumbnail: "/thumb.jpg",
  },
  description: "Тестовое описание тайтла",
  episodes_total: 12,
  average_duration_of_episode: 24,
  genres: [{ id: 1, name: "Экшен" }],
  episodes: [
    {
      id: "ep-1",
      name: "Серия 1",
      ordinal: 1,
      opening: { start: 90, stop: 180 },
      ending: { start: 1350, stop: 1440 },
      hls_1080: "https://stream/ep1_1080.m3u8",
      preview: { src: "/ep1.jpg" },
    },
    {
      id: "ep-2",
      name: "Серия 2",
      ordinal: 2,
      opening: { start: 90, stop: 180 },
      ending: { start: 1350, stop: 1440 },
      hls_1080: "https://stream/ep2_1080.m3u8",
      preview: { src: "/ep2.jpg" },
    },
    {
      id: "ep-3",
      name: "Серия 3",
      ordinal: 3,
      opening: { start: 90, stop: 180 },
      ending: { start: 1350, stop: 1440 },
      hls_1080: "https://stream/ep3_1080.m3u8",
      preview: { src: "/ep3.jpg" },
    },
    {
      id: "ep-4",
      name: "Серия 4",
      ordinal: 4,
      opening: { start: 90, stop: 180 },
      ending: { start: 1350, stop: 1440 },
      hls_1080: "https://stream/ep4_1080.m3u8",
      preview: { src: "/ep4.jpg" },
    },
    {
      id: "ep-5",
      name: "Серия 5",
      ordinal: 5,
      opening: { start: 90, stop: 180 },
      ending: { start: 1350, stop: 1440 },
      hls_1080: "https://stream/ep5_1080.m3u8",
      preview: { src: "/ep5.jpg" },
    },
  ],
};

describe("User Bug Fixes Verification", () => {
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

  it("proposes Episode 5 when Episode 4 is marked as watched", () => {
    // Episode 4 is marked as completed
    const historyItem: HistoryItem = {
      release_id: mockRelease.id,
      episode_id: "ep-4",
      episode_ordinal: 4,
      last_position: 1440,
      duration: 1440,
      is_completed: true,
      updated_at: new Date().toISOString(),
    };

    useCatalogStore.setState({ history: [historyItem] });

    render(<ReleaseDetails release={mockRelease} onBack={() => {}} />);

    // The button must NOT propose episode 4, but instead propose next unwatched episode 5!
    expect(screen.getByText("Продолжить с 5 эпизода")).toBeDefined();
    expect(screen.queryByText("Продолжить с 4 эпизода")).toBeNull();
  });

  it("proposes Episode 4 when Episode 4 is in progress", () => {
    // Episode 4 is partially watched (in progress)
    const historyItem: HistoryItem = {
      release_id: mockRelease.id,
      episode_id: "ep-4",
      episode_ordinal: 4,
      last_position: 720,
      duration: 1440,
      is_completed: false,
      updated_at: new Date().toISOString(),
    };

    useCatalogStore.setState({ history: [historyItem] });

    render(<ReleaseDetails release={mockRelease} onBack={() => {}} />);

    expect(screen.getByText("Продолжить с 4 эпизода")).toBeDefined();
  });

  it("settings menu in player only has upscale on/off toggle and no preset list", () => {
    render(<SettingsMenu currentQuality="1080p" onSelectQuality={() => {}} />);

    // Open the dropdown menu
    fireEvent.click(screen.getByTitle("Настройки плеера"));

    // Must have the on/off switch for upscale
    const upscaleSwitch = screen.getByRole("switch", { name: /апскейлер/i });
    expect(upscaleSwitch).toBeDefined();

    // Must NOT have preset selection buttons in the player settings
    expect(screen.queryByText(/Mode A\+A \(HQ/i)).toBeNull();
    expect(screen.queryByText(/Mode A \(Быстрый\)/i)).toBeNull();
    expect(screen.queryByText(/Mode B\+B/i)).toBeNull();
    expect(screen.queryByText(/Mode C\+A/i)).toBeNull();
  });

  it("continue watching displays as a carousel with next episode when episode is watched", () => {
    const historyItem: HistoryItem = {
      release_id: mockRelease.id,
      episode_id: "ep-4",
      episode_ordinal: 4,
      last_position: 1440,
      duration: 1440,
      is_completed: true,
      updated_at: new Date().toISOString(),
    };

    useCatalogStore.setState({
      history: [historyItem],
      cachedReleases: { [mockRelease.id]: mockRelease },
    });

    render(<ContinueWatching onSelectRelease={() => {}} />);

    // Must render Continue Watching section
    expect(screen.getByText("Продолжить просмотр")).toBeDefined();

    // Must have carousel scroll navigation buttons
    expect(screen.getByLabelText("Прокрутить назад")).toBeDefined();
    expect(screen.getByLabelText("Прокрутить вперед")).toBeDefined();

    // Must show next episode 5
    expect(screen.getByText("Серия 5")).toBeDefined();
    expect(screen.getByText("Следующая")).toBeDefined();
  });
});
