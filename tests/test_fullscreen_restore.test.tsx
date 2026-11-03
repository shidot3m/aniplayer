import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import { usePlayerHotkeys } from "@/features/player/hooks/usePlayerHotkeys";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { EpisodeItem, Release } from "../src/shared/types";

// Mock Tauri invoke
const mockInvoke = vi.fn().mockResolvedValue(null);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockRelease: Release = {
  id: 2001,
  name: { main: "Тестовое аниме" },
  type: { value: "tv", description: "ТВ" },
  year: 2024,
  episodes_total: 12,
  poster: { src: "/poster.jpg" },
  episodes: [
    {
      id: "ep-1",
      name: "Серия 1",
      ordinal: 1,
      hls_1080: "https://test/ep1.m3u8",
      duration: 1440,
    },
  ],
};

const mockEpisode: EpisodeItem = mockRelease.episodes[0];

function HotkeyTester({
  isFullscreen,
  exitFullscreen,
  onBack,
}: {
  isFullscreen: boolean;
  exitFullscreen: () => void;
  onBack: () => void;
}) {
  usePlayerHotkeys({
    onUserActivity: () => {},
    togglePlay: () => {},
    seekRelative: () => {},
    seekTo: () => {},
    setVolume: () => {},
    volume: 100,
    toggleMute: () => {},
    toggleFullscreen: () => {},
    exitFullscreen,
    isFullscreen,
    onBack,
    isInsideOpening: false,
    isInsideEnding: false,
    onNext: () => {},
    onPrev: () => {},
    setPreset: () => {},
  });

  return <div>Hotkey Tester</div>;
}

describe("Fullscreen restore on player exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    usePlayerStore.setState({
      isPlayerOpen: true,
      isPlaying: true,
      currentRelease: mockRelease,
      currentEpisode: mockEpisode,
    });
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("closePlayer() sends app_set_fullscreen false to Tauri and closes player", async () => {
    await usePlayerStore.getState().closePlayer();

    expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });

    const state = usePlayerStore.getState();
    expect(state.isPlayerOpen).toBe(false);
    expect(state.isPlaying).toBe(false);
    expect(state.currentRelease).toBeNull();
    expect(state.currentEpisode).toBeNull();
  });

  it("Escape key exits fullscreen when in fullscreen mode", () => {
    const exitFullscreen = vi.fn();
    const onBack = vi.fn();

    render(<HotkeyTester isFullscreen={true} exitFullscreen={exitFullscreen} onBack={onBack} />);

    fireEvent.keyDown(window, { code: "Escape" });

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Escape key triggers onBack when not in fullscreen mode", () => {
    const exitFullscreen = vi.fn();
    const onBack = vi.fn();

    render(<HotkeyTester isFullscreen={false} exitFullscreen={exitFullscreen} onBack={onBack} />);

    fireEvent.keyDown(window, { code: "Escape" });

    expect(exitFullscreen).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("PlayerOverlay calls exitFullscreen on back button click and on unmount", async () => {
    const onBack = vi.fn();
    const onGoToRelease = vi.fn();

    const { unmount } = render(
      <PlayerOverlay
        release={mockRelease}
        episode={mockEpisode}
        onBack={onBack}
        onGoToRelease={onGoToRelease}
      />,
    );

    // let the mount-time fullscreen status check settle inside act
    await act(async () => {});

    // Clicking back button should invoke app_set_fullscreen false
    const backBtn = screen.getByTestId("player-back-btn");
    await act(async () => {
      fireEvent.click(backBtn);
    });

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    // Unmounting component also cleans up fullscreen
    mockInvoke.mockClear();
    await act(async () => {
      unmount();
    });
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });
    });
  });
});
