import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PlayerOverlay } from "../src/components/player/PlayerOverlay";
import type { EpisodeItem, Release } from "../src/types";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("PlayerOverlay Layout", () => {
  it("places episode number above seekbar and controls in proper positions", () => {
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

    // Check back arrow top-left
    expect(screen.getByTestId("player-back-btn")).toBeDefined();

    // Check titles top-left (NO episode number in top bar)
    expect(screen.getByText("Адский режим")).toBeDefined();

    // Episode number MUST be above timeline
    const epBadge = screen.getByTestId("player-episode-badge-above-timeline");
    expect(epBadge).toBeDefined();
    expect(epBadge.textContent).toContain("Эпизод 1");

    // Timecodes above timeline right
    expect(screen.getByTestId("player-timecodes-above-timeline")).toBeDefined();

    // Center playback buttons
    expect(screen.getByTestId("player-play-pause-btn")).toBeDefined();
    expect(screen.getByTestId("player-prev-btn")).toBeDefined();
    expect(screen.getByTestId("player-next-btn")).toBeDefined();

    // Left controls below timeline
    expect(screen.getByTestId("player-to-anime-btn")).toBeDefined();
    expect(screen.getByTestId("player-episode-drawer-btn")).toBeDefined();
  });
});
