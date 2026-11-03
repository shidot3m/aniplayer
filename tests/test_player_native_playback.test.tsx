import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import type { EpisodeItem, Release } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

const release: Release = {
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

const episode: EpisodeItem = release.episodes[0];

describe("native player controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    usePlayerStore.setState({
      isPlayerOpen: false,
      isPlaying: false,
      isMuted: false,
      currentTime: 0,
      volume: 80,
      speed: 1,
      anime4kEnabled: true,
      anime4kPreset: "Mode A+A (HQ)",
      preferredQuality: "1080p",
    });
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("opens the selected episode at the requested watch position", async () => {
    await usePlayerStore.getState().openPlayer(release, episode, 125);

    expect(invoke).toHaveBeenCalledWith("player_open", {
      request: {
        source: "https://test/ep1.m3u8",
        start: 125,
        volume: 80,
        muted: false,
        speed: 1,
        anime4kEnabled: true,
        preset: "Mode A+A (HQ)",
      },
    });
    expect(usePlayerStore.getState().currentTime).toBe(125);
  });

  it("drives pause, seeking, volume, speed and Anime4K through the native player", async () => {
    const store = usePlayerStore.getState();
    await store.openPlayer(release, episode);
    vi.mocked(invoke).mockClear();

    await store.pause();
    await store.play();
    await store.seek(30);
    await store.seekRelative(5);
    await store.setVolume(50);
    await store.toggleMute();
    await store.setSpeed(1.5);
    await store.setPreset("Mode B (HQ)");
    await store.toggleAnime4k();
    await store.closePlayer();

    expect(invoke).toHaveBeenCalledWith("player_set_pause", { paused: true });
    expect(invoke).toHaveBeenCalledWith("player_set_pause", { paused: false });
    expect(invoke).toHaveBeenCalledWith("player_seek", { seconds: 30 });
    expect(invoke).toHaveBeenCalledWith("player_seek", { seconds: 35 });
    expect(invoke).toHaveBeenCalledWith("player_set_volume", { volume: 50, muted: false });
    expect(invoke).toHaveBeenCalledWith("player_set_volume", { volume: 50, muted: true });
    expect(invoke).toHaveBeenCalledWith("player_set_speed", { speed: 1.5 });
    expect(invoke).toHaveBeenCalledWith("player_set_anime4k", {
      enabled: true,
      preset: "Mode B (HQ)",
    });
    expect(invoke).toHaveBeenCalledWith("player_set_anime4k", {
      enabled: false,
      preset: "Mode B (HQ)",
    });
    expect(invoke).toHaveBeenCalledWith("player_close");
  });

  it("keeps the watch position when the user changes quality", async () => {
    const multiQuality: Release = {
      ...release,
      episodes: [{ ...episode, hls_720: "https://test/ep1-720.m3u8" }],
    };
    const store = usePlayerStore.getState();
    await store.openPlayer(multiQuality, multiQuality.episodes[0], 90);
    vi.mocked(invoke).mockClear();

    await store.setQuality("720p");

    expect(invoke).toHaveBeenCalledWith("player_open", {
      request: {
        source: "https://test/ep1-720.m3u8",
        start: 90,
        volume: 80,
        muted: false,
        speed: 1,
        anime4kEnabled: true,
        preset: "Mode A+A (HQ)",
      },
    });
    expect(usePlayerStore.getState().activeQuality).toBe("720p");
  });
});
