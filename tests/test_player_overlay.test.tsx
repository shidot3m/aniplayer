import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { EpisodeItem, Release } from "../src/shared/types";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("PlayerOverlay Layout", () => {
  it("places episode number above seekbar and controls in proper positions", async () => {
    const mockRelease: Release = {
      id: 10239,
      name: { main: "Адский режим", english: "Hell Mode", alternative: "ヘルモード" },
      type: { value: "tv", description: "ТВ" },
      year: 2025,
      episodes_total: 12,
      poster: { src: "/poster.jpg" },
      episodes: [
        { id: "ep1", ordinal: 1, name: "Серия 1" },
        { id: "ep2", ordinal: 2, name: "Серия 2" },
      ],
    };

    const mockEpisode: EpisodeItem = {
      id: "ep1",
      ordinal: 1,
      name: "Призыв в другой мир",
      duration: 1440,
    };

    render(
      <PlayerOverlay
        release={mockRelease}
        episode={mockEpisode}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );

    // let the mount-time fullscreen status check settle inside act
    await act(async () => {});

    // Check back arrow top-left
    expect(screen.getByTestId("player-back-btn")).toBeDefined();

    // Check titles top-left
    expect(screen.getByText("Адский режим")).toBeDefined();

    // Episode number and its timecode sit in the top row
    const epLabel = screen.getByTestId("player-episode-label");
    expect(epLabel).toBeDefined();
    expect(epLabel.textContent).toContain("Эпизод 1");

    // Timecodes flank the seek bar
    expect(screen.getByTestId("player-timecodes-above-timeline")).toBeDefined();

    // Center playback buttons
    expect(screen.getByTestId("player-play-pause-btn")).toBeDefined();
    expect(screen.getByTestId("player-prev-btn")).toBeDefined();
    expect(screen.getByTestId("player-next-btn")).toBeDefined();

    // Left controls below timeline
    expect(screen.getByTestId("player-to-anime-btn")).toBeDefined();
    expect(screen.getByTestId("player-episode-drawer-btn")).toBeDefined();

    // Quality and speed are pickers on the bar (their glass is a visual pass in #74)
    expect(screen.getByLabelText("Качество видео")).toBeDefined();
    expect(screen.getByLabelText("Скорость воспроизведения")).toBeDefined();
  });
});
