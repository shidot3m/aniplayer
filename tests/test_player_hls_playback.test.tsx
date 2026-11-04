import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player/state/playerStore";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import type { EpisodeItem, Release } from "@/shared/types";
import {
  activeSession,
  FakeHls,
  installMediaElementStub,
  resetHlsStub,
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
const NEXT_EPISODE_1080 = "https://cache.test/videos/10303/6/1080/z.m3u8";
const OFFLINE_PLAYLIST = "C:\\aniplayer\\downloads\\10303\\5\\index.m3u8";
// The shape `playback::asset_url` returns: one segment per directory, so hls.js resolves the
// Episode's bare segment names beside the playlist instead of at the origin's root.
const OFFLINE_ASSET_URL = "http://asset.localhost/C%3A/aniplayer/downloads/10303/5/index.m3u8";

const first: EpisodeItem = {
  id: "ep-1",
  ordinal: 5,
  name: "Серия 5",
  duration: 1440,
  hls_1080: EPISODE_1080,
  hls_720: EPISODE_720,
};

const next: EpisodeItem = {
  id: "ep-2",
  ordinal: 6,
  name: "Серия 6",
  duration: 1440,
  hls_1080: NEXT_EPISODE_1080,
};

const release: Release = {
  id: 10303,
  name: { main: "Одно окно" },
  type: { value: "tv", description: "ТВ" },
  year: 2026,
  episodes_total: 2,
  poster: { src: "/poster.jpg" },
  episodes: [first, next],
};

/** Answers like the backend does: a stream URL passes through, a path becomes an asset URL. */
function resolveSources(local: Record<string, string> = {}): void {
  tauri.invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command !== "player_resolve_source") return null;
    const source = String(args?.source ?? "");
    return local[source] ?? source;
  });
}

/** The shell's own order of operations: the overlay mounts, the store opens the session. */
function Harness({ episode, startPos = 0 }: { episode: EpisodeItem; startPos?: number }) {
  useEffect(() => {
    void usePlayerStore.getState().openPlayer(release, episode, startPos);
  }, [episode, startPos]);
  return (
    <PlayerOverlay release={release} episode={episode} onBack={() => {}} onGoToRelease={() => {}} />
  );
}

async function openPlayer(episode: EpisodeItem = first, startPos = 0) {
  const view = render(<Harness episode={episode} startPos={startPos} />);
  await act(async () => {});
  return {
    ...view,
    video: () => view.container.querySelector("video") as HTMLVideoElement,
  };
}

async function whenReady(video: HTMLVideoElement): Promise<void> {
  await act(async () => {
    video.dispatchEvent(new Event("loadedmetadata"));
  });
}

describe("WebView playback", () => {
  beforeEach(() => {
    resetHlsStub();
    installMediaElementStub();
    setMediaDuration(1440);
    localStorage.clear();
    tauri.invoke.mockReset();
    resolveSources();
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    closePlayerShell();
  });

  it("plays a stream in the application window, with no second surface to stack", async () => {
    const { video } = await openPlayer();
    const session = activeSession();

    expect(video()).not.toBeNull();
    expect(session?.media).toBe(video());
    expect(session?.loadedSource).toBe(EPISODE_1080);
    expect(FakeHls.instances).toHaveLength(1);
  });

  it("plays a downloaded Offline playlist from disk over the asset protocol", async () => {
    const offline: EpisodeItem = {
      ...first,
      hls_1080: OFFLINE_PLAYLIST,
      hls_720: OFFLINE_PLAYLIST,
      hls_480: OFFLINE_PLAYLIST,
    };
    resolveSources({ [OFFLINE_PLAYLIST]: OFFLINE_ASSET_URL });

    await openPlayer(offline);

    expect(tauri.invoke).toHaveBeenCalledWith("player_resolve_source", {
      source: OFFLINE_PLAYLIST,
    });
    expect(activeSession()?.loadedSource).toBe(OFFLINE_ASSET_URL);
  });

  it("resumes an Episode at its Watch progress when the media can be measured", async () => {
    const { video } = await openPlayer(first, 300);

    await whenReady(video());

    expect(video().currentTime).toBe(300);
    expect(video().play).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("switches Quality under the live session, keeping the position and the frame", async () => {
    resolveSources();
    const { video } = await openPlayer();
    const session = activeSession() as FakeHls;
    const before = video();

    await act(async () => {
      before.currentTime = 640;
      before.dispatchEvent(new Event("timeupdate"));
    });
    await act(async () => {
      await usePlayerStore.getState().setQuality("720p");
    });
    await whenReady(before);

    expect(activeSession()).toBe(session);
    expect(FakeHls.instances).toHaveLength(1);
    expect(session.loadedSource).toBe(EPISODE_720);
    expect(before.currentTime).toBe(640);
    expect(usePlayerStore.getState().playbackError).toBeNull();
  });

  it("takes volume, speed and seek from the React controls onto the media element", async () => {
    const { video } = await openPlayer();
    const element = video();
    await whenReady(element);

    await act(async () => {
      await usePlayerStore.getState().setVolume(40);
      await usePlayerStore.getState().setSpeed(1.5);
      await usePlayerStore.getState().seekTo(90);
      await usePlayerStore.getState().pause();
    });

    expect(element.volume).toBeCloseTo(0.4);
    expect(element.playbackRate).toBeCloseTo(1.5);
    expect(element.currentTime).toBe(90);
    expect(element.paused).toBe(true);
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await act(async () => {
      await usePlayerStore.getState().play();
    });
    expect(element.paused).toBe(false);
  });

  it("recovers a media error once before it explains the failure to the user", async () => {
    await openPlayer();
    const session = activeSession() as FakeHls;

    act(() => {
      session.emit(FakeHls.Events.ERROR, {
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        fatal: true,
      });
    });

    expect(session.recoverMediaError).toHaveBeenCalledOnce();
    expect(usePlayerStore.getState().playbackError).toBeNull();

    act(() => {
      session.emit(FakeHls.Events.ERROR, {
        type: FakeHls.ErrorTypes.MEDIA_ERROR,
        fatal: true,
      });
    });
    await act(async () => {});

    expect(screen.getByText("Этот поток не декодируется на машине")).toBeDefined();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("carries the element's position and ending into the store and the next Episode", async () => {
    usePlayerStore.setState({ autoplayNext: true });
    const { video } = await openPlayer();
    const session = activeSession() as FakeHls;

    await act(async () => {
      video().currentTime = 100;
      video().dispatchEvent(new Event("timeupdate"));
    });
    expect(usePlayerStore.getState().currentTime).toBe(100);
    expect(usePlayerStore.getState().duration).toBe(1440);

    await act(async () => {
      video().dispatchEvent(new Event("ended"));
    });
    await whenReady(video());

    expect(session.loadedSource).toBe(NEXT_EPISODE_1080);
    expect(FakeHls.instances).toHaveLength(1);
    expect(usePlayerStore.getState().currentEpisode?.id).toBe("ep-2");
  });

  it("promises a frame only while the media is starved, never while the user is paused", async () => {
    const { video } = await openPlayer();

    expect(screen.getByText("Загрузка видеопотока...")).toBeDefined();

    setMediaReadyState(3);
    await act(async () => {
      video().dispatchEvent(new Event("canplay"));
    });
    expect(screen.queryByText("Загрузка видеопотока...")).toBeNull();

    await act(async () => {
      await usePlayerStore.getState().pause();
    });
    expect(screen.queryByText("Загрузка видеопотока...")).toBeNull();

    setMediaReadyState(0);
    await act(async () => {
      video().dispatchEvent(new Event("waiting"));
    });
    expect(screen.getByText("Загрузка видеопотока...")).toBeDefined();
  });
});
