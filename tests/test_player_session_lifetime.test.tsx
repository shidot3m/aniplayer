import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playback } from "@/features/player/renderer/playbackSession";
import { usePlayerStore } from "@/features/player/state/playerStore";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { Release } from "@/shared/types";
import {
  activeSession,
  FakeHls,
  installMediaElementStub,
  resetHlsStub,
  setMediaDuration,
} from "./helpers/playbackStubs";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => tauri.invoke(...(args as [])),
  convertFileSrc: (path: string) => `http://asset.localhost/${encodeURIComponent(path)}`,
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

describe("player session lifetime", () => {
  beforeEach(() => {
    playback.close();
    resetHlsStub();
    installMediaElementStub();
    setMediaDuration(1440);
    localStorage.clear();
    tauri.invoke.mockReset();
    tauri.invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) =>
      command === "player_resolve_source"
        ? { kind: "remote", value: String(args?.source ?? "") }
        : null,
    );
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
      playbackError: null,
      currentRelease: release,
      currentEpisode: release.episodes[0],
    });
  });

  it("keeps the playback session alive while the episode switches", async () => {
    const { rerender } = render(
      <PlayerOverlay
        release={release}
        episode={release.episodes[0]}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );
    await act(async () => {});
    await act(async () => {
      await usePlayerStore.getState().openPlayer(release, release.episodes[0]);
    });
    const session = activeSession();

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

    expect(FakeHls.instances).toHaveLength(1);
    expect(session?.destroy).not.toHaveBeenCalled();
    expect(session?.loadedSource).toBe("https://test/ep2.m3u8");
  });

  it("leaves the session to the store when the overlay unmounts", async () => {
    const { unmount } = render(
      <PlayerOverlay
        release={release}
        episode={release.episodes[0]}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );
    await act(async () => {
      await usePlayerStore.getState().openPlayer(release, release.episodes[0]);
    });
    const session = activeSession();

    unmount();
    await act(async () => {});

    expect(session?.destroy).not.toHaveBeenCalled();
    expect(session?.media).toBeNull();
  });

  it("keeps the session through the remount React does in development", async () => {
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
    await act(async () => {
      await usePlayerStore.getState().openPlayer(release, release.episodes[0]);
    });
    const session = activeSession();
    expect(session?.destroy).not.toHaveBeenCalled();
    expect(session?.media).not.toBeNull();
    expect(FakeHls.instances).toHaveLength(1);

    unmount();
    await act(async () => {});
    expect(session?.destroy).not.toHaveBeenCalled();
  });
});
