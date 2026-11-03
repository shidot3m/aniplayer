import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player/state/playerStore";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { Release } from "../src/shared/types";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const release: Release = {
  id: 4100,
  name: { main: "Две серии" },
  type: { value: "tv", description: "ТВ" },
  year: 2025,
  episodes_total: 2,
  poster: { src: "/poster.jpg" },
  episodes: [
    { id: "ep-1", ordinal: 1, name: "Серия 1", hls_1080: "https://test/ep1.m3u8", duration: 1440 },
    { id: "ep-2", ordinal: 2, name: "Серия 2", hls_1080: "https://test/ep2.m3u8", duration: 1440 },
  ],
};

function closedPlayerCalls() {
  return mockInvoke.mock.calls.filter(([cmd]) => cmd === "player_close");
}

describe("player session lifetime", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(null);
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    usePlayerStore.setState({
      isPlayerOpen: true,
      isPlaying: true,
      currentTime: 10,
      duration: 1440,
      volume: 70,
      isMuted: false,
      speed: 1,
      anime4kEnabled: false,
      anime4kPreset: "Mode A (HQ)",
      preferredQuality: "1080p",
      activeQuality: "1080p",
      autoplayNext: false,
      autoSkipOpEd: false,
      currentRelease: release,
      currentEpisode: release.episodes[0],
    });
  });

  it("keeps the native session alive while the episode switches", async () => {
    const { rerender } = render(
      <PlayerOverlay
        release={release}
        episode={release.episodes[0]}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );

    await act(async () => {
      await usePlayerStore.getState().playEpisode(release, release.episodes[1]);
    });
    rerender(
      <PlayerOverlay
        release={release}
        episode={release.episodes[1]}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );
    await act(async () => {});

    expect(closedPlayerCalls()).toHaveLength(0);
    const opened = mockInvoke.mock.calls.filter(([cmd]) => cmd === "player_open");
    expect(opened[opened.length - 1]?.[1]).toEqual(
      expect.objectContaining({
        request: expect.objectContaining({ source: "https://test/ep2.m3u8" }),
      }),
    );
  });

  it("leaves the native session to the store when the overlay unmounts", async () => {
    const { unmount } = render(
      <PlayerOverlay
        release={release}
        episode={release.episodes[0]}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );

    unmount();
    await act(async () => {});

    expect(closedPlayerCalls()).toHaveLength(0);
  });

  it("keeps the native session through the remount React does in development", async () => {
    const { unmount } = render(
      <StrictMode>
        <PlayerOverlay
          release={release}
          episode={release.episodes[0]}
          onBack={() => {}}
          onGoToRelease={() => {}}
        />
      </StrictMode>,
    );

    await act(async () => {});
    expect(closedPlayerCalls()).toHaveLength(0);

    unmount();
    await act(async () => {});
    expect(closedPlayerCalls()).toHaveLength(0);
  });
});
