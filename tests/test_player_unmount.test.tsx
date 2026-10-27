import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoHide, useFullscreen } from "@/features/player/hooks/usePlayerOverlayState";
import { usePlayerStore } from "@/features/player/state/playerStore";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { EpisodeItem, Release } from "../src/shared/types";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockRelease: Release = {
  id: 3003,
  name: { main: "После выхода" },
  type: { value: "tv", description: "ТВ" },
  year: 2025,
  episodes_total: 2,
  poster: { src: "/poster.jpg" },
  episodes: [
    { id: "ep-1", ordinal: 1, name: "Серия 1", hls_1080: "https://test/ep1.m3u8", duration: 1440 },
    { id: "ep-2", ordinal: 2, name: "Серия 2", hls_1080: "https://test/ep2.m3u8", duration: 1440 },
  ],
};

const mockEpisode: EpisodeItem = mockRelease.episodes[0];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function expectNoActWarning() {
  const calls: unknown[][] = consoleErrorSpy.mock.calls;
  const actWarnings = calls.filter((args: unknown[]) =>
    args.some((a: unknown) => typeof a === "string" && a.includes("not wrapped in act")),
  );
  expect(actWarnings).toEqual([]);
}

let setVisibilitySink: (v: boolean) => void = () => {};
let setFullscreenApi: (api: ReturnType<typeof useFullscreen>) => void = () => {};

function AutoHideProbe() {
  const { isVisible } = useAutoHide(true, false);
  setVisibilitySink(isVisible);
  return null;
}

function FullscreenProbe() {
  setFullscreenApi(useFullscreen());
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  mockInvoke.mockReset();
  mockInvoke.mockImplementation((cmd: string) =>
    cmd === "app_is_fullscreen" ? Promise.resolve(true) : Promise.resolve(null),
  );
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
});

afterEach(() => {
  vi.useRealTimers();
  setVisibilitySink = () => {};
  setFullscreenApi = () => {};
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe("useAutoHide unmount safety", () => {
  it("cancels its pending hide timer on unmount", () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const created: ReturnType<typeof setTimeout>[] = [];
    const cleared = new Set<ReturnType<typeof setTimeout>>();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      cb: () => void,
      ms?: number,
    ) => {
      const handle = originalSetTimeout(cb, ms);
      created.push(handle);
      return handle;
    }) as unknown as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(((
      handle?: ReturnType<typeof setTimeout>,
    ) => {
      if (handle) cleared.add(handle);
      return originalClearTimeout(handle);
    }) as unknown as typeof clearTimeout);

    try {
      const { unmount } = render(<AutoHideProbe />);
      expect(created.length).toBeGreaterThan(0);

      act(() => {
        unmount();
      });

      for (const handle of created) {
        expect(cleared.has(handle)).toBe(true);
      }
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it("does not change visibility when timers elapse after unmount", async () => {
    let lastVisible = true;
    setVisibilitySink = (v) => {
      lastVisible = v;
    };

    const { unmount } = render(<AutoHideProbe />);
    expect(lastVisible).toBe(true);

    unmount();
    consoleErrorSpy.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(lastVisible).toBe(true);
    expectNoActWarning();
  });
});

describe("useFullscreen unmount safety", () => {
  let latest: ReturnType<typeof useFullscreen> | null = null;

  beforeEach(() => {
    latest = null;
    setFullscreenApi = (api) => {
      latest = api;
    };
  });

  it("still exits native and Tauri fullscreen on overlay unmount", async () => {
    const { unmount } = render(
      <PlayerOverlay
        release={mockRelease}
        episode={mockEpisode}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );
    await act(async () => {});
    mockInvoke.mockClear();

    unmount();
    await act(async () => {});

    expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });
    expectNoActWarning();
  });

  it("exitFullscreenSideEffect performs the exit without touching hook state", async () => {
    const { unmount } = render(<FullscreenProbe />);
    await act(async () => {});
    expect(latest?.isFullscreen).toBe(true);

    const api = latest as ReturnType<typeof useFullscreen>;
    unmount();
    consoleErrorSpy.mockClear();

    await act(async () => {
      await api.exitFullscreenSideEffect();
    });

    expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });
    expect(latest?.isFullscreen).toBe(true);
    expectNoActWarning();
  });

  it("fullscreen writes do not leak into the post-unmount window", async () => {
    const { unmount } = render(<FullscreenProbe />);
    await act(async () => {});
    expect(latest?.isFullscreen).toBe(true);

    const api = latest as ReturnType<typeof useFullscreen>;
    unmount();
    consoleErrorSpy.mockClear();

    // a click handler racing the unmount must not schedule a state write
    await act(async () => {
      api.exitFullscreen();
      api.toggleFullscreen();
      vi.advanceTimersByTime(1000);
    });

    expectNoActWarning();
  });
});

describe("PlayerOverlay unmount lifecycle", () => {
  it("cancels all player timers when unmounted during fullscreen", () => {
    usePlayerStore.setState({ isPlaying: true });
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const created: ReturnType<typeof setTimeout>[] = [];
    const cleared = new Set<ReturnType<typeof setTimeout>>();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      cb: () => void,
      ms?: number,
    ) => {
      const handle = originalSetTimeout(cb, ms);
      created.push(handle);
      return handle;
    }) as unknown as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(((
      handle?: ReturnType<typeof setTimeout>,
    ) => {
      if (handle) cleared.add(handle);
      return originalClearTimeout(handle);
    }) as unknown as typeof clearTimeout);

    try {
      const { unmount } = render(
        <PlayerOverlay
          release={mockRelease}
          episode={mockEpisode}
          onBack={() => {}}
          onGoToRelease={() => {}}
        />,
      );

      // user activity schedules the auto-hide timer
      act(() => {
        fireEvent.pointerMove(window);
      });

      act(() => {
        unmount();
      });

      expect(created.length).toBeGreaterThan(0);
      for (const handle of created) {
        expect(cleared.has(handle)).toBe(true);
      }
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it("produces no act warnings when unmounted during fullscreen", async () => {
    const { unmount } = render(
      <PlayerOverlay
        release={mockRelease}
        episode={mockEpisode}
        onBack={() => {}}
        onGoToRelease={() => {}}
      />,
    );

    // resolve the mount-time app_is_fullscreen check (fullscreen -> true)
    await act(async () => {});

    unmount();
    consoleErrorSpy.mockClear();

    // drain late promise resolutions, then let every remaining timer elapse
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expectNoActWarning();
  });

  it("back navigation exits fullscreen before calling onBack", async () => {
    const onBack = vi.fn();
    const onGoToRelease = vi.fn();
    render(
      <PlayerOverlay
        release={mockRelease}
        episode={mockEpisode}
        onBack={onBack}
        onGoToRelease={onGoToRelease}
      />,
    );

    await act(async () => {});
    fireEvent.click(screen.getByTestId("player-back-btn"));
    await act(async () => {});

    expect(mockInvoke).toHaveBeenCalledWith("app_set_fullscreen", { fullscreen: false });
    expect(onBack).toHaveBeenCalledTimes(1);
    expectNoActWarning();
  });
});
