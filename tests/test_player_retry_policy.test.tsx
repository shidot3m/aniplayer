import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player/state/playerStore";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { EpisodeItem, Release } from "@/shared/types";
import {
  activeSession,
  FakeHls,
  installMediaElementStub,
  resetHlsStub,
  setMediaBuffered,
  setMediaDuration,
  setMediaReadyState,
} from "./helpers/playbackStubs";
import { closePlayerShell } from "./helpers/playerShell";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => tauri.invoke(...(args as [])),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const EPISODE_1080 = "https://cache.test/videos/10303/5/1080/x.m3u8";
const EPISODE_720 = "https://cache.test/videos/10303/5/720/y.m3u8";

const episode: EpisodeItem = {
  id: "ep-1",
  ordinal: 5,
  name: "Серия 5",
  duration: 1440,
  hls_1080: EPISODE_1080,
  hls_720: EPISODE_720,
};

const release: Release = {
  id: 10303,
  name: { main: "Одно окно" },
  type: { value: "tv", description: "ТВ" },
  year: 2026,
  episodes_total: 1,
  poster: { src: "/poster.jpg" },
  episodes: [episode],
};

/**
 * Measured on the live stream in the #62 pass: `#EXT-X-TARGETDURATION: 12`, median segment 10 s,
 * 138 segments per 22:55 Episode, each one a 302 onto one of several CDN backends. These are the
 * numbers the player commits to against that shape: a request that stops answering is cut off in
 * seconds, retried a bounded number of times with a growing pause, and never retried for longer
 * than the pause it would cost the viewer.
 */
const SEGMENT_POLICY = {
  maxTimeToFirstByteMs: 8000,
  maxLoadTimeMs: 20000,
  timeoutRetry: {
    maxNumRetry: 2,
    retryDelayMs: 500,
    maxRetryDelayMs: 2000,
    backoff: "exponential",
  },
  errorRetry: {
    maxNumRetry: 2,
    retryDelayMs: 500,
    maxRetryDelayMs: 4000,
    backoff: "exponential",
  },
};

const PLAYLIST_POLICY = {
  maxTimeToFirstByteMs: 8000,
  maxLoadTimeMs: 12000,
  timeoutRetry: {
    maxNumRetry: 3,
    retryDelayMs: 1000,
    maxRetryDelayMs: 8000,
    backoff: "exponential",
  },
  errorRetry: {
    maxNumRetry: 3,
    retryDelayMs: 1000,
    maxRetryDelayMs: 8000,
    backoff: "exponential",
  },
};

function Harness() {
  useEffect(() => {
    void usePlayerStore.getState().openPlayer(release, episode, 0);
  }, []);
  return (
    <PlayerOverlay release={release} episode={episode} onBack={() => {}} onGoToRelease={() => {}} />
  );
}

/** Mounts the overlay and lets the session reach the library. */
async function openPlayer(): Promise<HTMLVideoElement> {
  const view = render(<Harness />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return view.container.querySelector("video") as HTMLVideoElement;
}

/** What the network layer emits once every retry it was given has run out on one host. */
function fatalNetwork(): void {
  act(() => {
    activeSession()?.emit(FakeHls.Events.ERROR, {
      type: FakeHls.ErrorTypes.NETWORK_ERROR,
      details: FakeHls.ErrorDetails.FRAG_LOAD_ERROR,
      fatal: true,
    });
  });
}

/** What the network layer emits when a segment failed but the library still wants to retry it. */
function segmentLoadFailed(): void {
  act(() => {
    activeSession()?.emit(FakeHls.Events.ERROR, {
      type: FakeHls.ErrorTypes.NETWORK_ERROR,
      details: FakeHls.ErrorDetails.FRAG_LOAD_ERROR,
      fatal: false,
    });
  });
}

/** A segment landing on the media element: proof that some host answered. */
function fragmentArrived(): void {
  act(() => {
    activeSession()?.emit(FakeHls.Events.FRAG_LOADED, {});
  });
}

/** Moves the playhead to a position and reports it, the way the element does as it plays. */
async function parkAt(video: HTMLVideoElement, seconds: number): Promise<void> {
  await act(async () => {
    video.currentTime = seconds;
    video.dispatchEvent(new Event("timeupdate"));
  });
}

/**
 * The walk the session takes when the network stops answering: one segment further into the
 * playlist each step, with a longer pause. Measured in docs/evidence/62, a segment is ~12 s
 * (`#EXT-X-TARGETDURATION`), the CDN backend is chosen by the segment path and stays chosen, so
 * the only way to reach a live machine is to ask for a different segment — and a different segment
 * lives past the hole the dead one left. The tests anchor on a buffer that ends at 371 s.
 */
const HOLE = 371;
const WALK = [
  { attempt: 1, position: 383, pauseMs: 2000 },
  { attempt: 2, position: 395, pauseMs: 2000 },
  { attempt: 3, position: 407, pauseMs: 4000 },
  { attempt: 4, position: 419, pauseMs: 4000 },
  { attempt: 5, position: 431, pauseMs: 8000 },
  { attempt: 6, position: 443, pauseMs: 8000 },
];

/** Media up to `HOLE` is buffered and playable; nothing beyond it. */
async function bufferUpToTheHole(video: HTMLVideoElement, at: number): Promise<void> {
  setMediaBuffered([290, HOLE]);
  setMediaReadyState(4);
  await parkAt(video, at);
}

/** The element has eaten that buffer and cannot advance: `HAVE_CURRENT_DATA` and no more. */
async function starveAtTheHole(video: HTMLVideoElement): Promise<void> {
  setMediaReadyState(2);
  await parkAt(video, HOLE);
  await act(async () => {
    video.dispatchEvent(new Event("waiting"));
  });
}

describe("Bounded retries against CDN host rotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetHlsStub();
    installMediaElementStub();
    setMediaBuffered(null);
    setMediaDuration(1440);
    closePlayerShell();
    tauri.invoke.mockReset();
    tauri.invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) =>
      command === "player_resolve_source" ? String(args?.source ?? "") : null,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the library for its own load policy and its own worker, not for the defaults", async () => {
    await openPlayer();

    const config = activeSession()?.config as Record<string, unknown>;
    expect(config.fragLoadPolicy).toEqual({ default: SEGMENT_POLICY });
    expect(config.playlistLoadPolicy).toEqual({ default: PLAYLIST_POLICY });
    expect(config.manifestLoadPolicy).toEqual({ default: PLAYLIST_POLICY });
    expect(config.enableWorker).toBe(true);
    expect(config.workerPath).toContain("hls.worker");
  });

  it("keeps playing what it already has while a segment ahead of the playhead fails", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);

    // Measured live: at 332 s the element had 371 s buffered, so a dead segment starting at 371
    // costs the viewer nothing yet. Walking past it now would throw away 39 s of watchable media
    // to skip 12 s, so the session waits and lets its retries run in the background.
    for (let failure = 0; failure < 3; failure++) {
      segmentLoadFailed();
    }
    fatalNetwork();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(session.startLoad).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(332);
    expect(usePlayerStore.getState().playbackError).toBeNull();

    // Nothing new has to fail for the walk to start: the media running out is the trigger the
    // failures were waiting for.
    await starveAtTheHole(video);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(session.startLoad).toHaveBeenNthCalledWith(1, 383);
  });

  it("walks past the hole the moment the media it holds runs out", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);

    segmentLoadFailed();
    segmentLoadFailed();
    segmentLoadFailed();
    // The buffer played to its edge; now the dead segment is the thing standing between the
    // viewer and the next frame.
    await starveAtTheHole(video);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(session.startLoad).toHaveBeenNthCalledWith(1, 383);
    // Crossing the hole is what moves the loader: telling it a position without moving the
    // element leaves it re-requesting the dead segment it was already stuck on.
    expect(video.currentTime).toBe(383);
    expect(usePlayerStore.getState().playbackError).toBeNull();
    expect(screen.queryByText("Не удалось воспроизвести эпизод")).toBeNull();
  });

  it("walks one segment further per attempt while the network keeps failing", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);
    await starveAtTheHole(video);

    for (const step of WALK) {
      fatalNetwork();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(step.pauseMs);
      });
      expect(session.startLoad).toHaveBeenNthCalledWith(step.attempt, step.position);
      expect(usePlayerStore.getState().playbackError).toBeNull();
      expect(screen.queryByText("Не удалось воспроизвести эпизод")).toBeNull();
    }

    fatalNetwork();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Не удалось загрузить поток: сеть не отвечает")).toBeDefined();
  });

  it("walks on its own count of failed segments, without waiting for a fatal error", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);
    await starveAtTheHole(video);

    // Measured on the live app: a single-tier VOD playlist never makes hls.js declare a segment
    // failure fatal — it retries the same segment forever, which is the frozen frame of #45. The
    // session counts those failures itself and escalates when its own bound is reached.
    for (let failure = 0; failure < 2; failure++) {
      segmentLoadFailed();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(session.startLoad).not.toHaveBeenCalled();
    }

    segmentLoadFailed();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(session.startLoad).toHaveBeenNthCalledWith(1, 383);
    expect(usePlayerStore.getState().playbackError).toBeNull();
  });

  it("keeps one escalation in flight, so a burst of failures spends one step of the walk", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);
    await starveAtTheHole(video);

    for (let failure = 0; failure < 3; failure++) {
      segmentLoadFailed();
    }
    // While that restart is queued the library keeps reporting the same dead fragment. Those
    // reports are one problem, not three, so the walk must still start from its first step.
    for (let failure = 0; failure < 3; failure++) {
      segmentLoadFailed();
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(session.startLoad).toHaveBeenNthCalledWith(1, 383);
    expect(session.startLoad).toHaveBeenCalledTimes(1);

    fatalNetwork();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(session.startLoad).toHaveBeenNthCalledWith(2, 395);
  });

  it("spends its budget on a streak of dead hosts, not on a long episode", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);
    await starveAtTheHole(video);

    for (let host = 0; host < 6; host++) {
      fatalNetwork();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });
      // Some host answered: the streak is over and the walk starts from the next hole.
      setMediaBuffered([383, 455]);
      setMediaReadyState(4);
      fragmentArrived();
      await starveAtTheHole(video);
    }

    expect(session.startLoad).toHaveBeenCalledTimes(6);
    expect(screen.queryByText("Не удалось воспроизвести эпизод")).toBeNull();
    expect(usePlayerStore.getState().playbackError).toBeNull();
  });

  it("switches Quality while a restart is still in flight, without losing the session", async () => {
    const video = await openPlayer();
    const session = activeSession() as FakeHls;
    await bufferUpToTheHole(video, 332);
    await starveAtTheHole(video);

    fatalNetwork();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await usePlayerStore.getState().setQuality("720p");
    });

    expect(activeSession()).toBe(session);
    expect(session.loadedSource).toBe(EPISODE_720);
    // The switch is the newer answer to the same problem: the pending reopen is dropped, not
    // stacked on top of a source that already moved.
    expect(session.startLoad).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().playbackError).toBeNull();
    expect(screen.queryByText("Не удалось воспроизвести эпизод")).toBeNull();
  });
});
