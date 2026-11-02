import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import type { EpisodeItem, Release } from "@/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
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

function invokedCommands(): unknown[] {
  return vi.mocked(invoke).mock.calls.map(([command]) => command);
}

describe("Player store without a native backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    usePlayerStore.setState({
      isPlayerOpen: false,
      isPlaying: false,
      isMuted: false,
      volume: 80,
      anime4kEnabled: true,
      anime4kPreset: "Mode A+A (HQ)",
      preferredQuality: "1080p",
    });
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("never invokes player_* commands", async () => {
    const store = usePlayerStore.getState();

    await store.openPlayer(release, episode);
    await store.play();
    await store.pause();
    await store.seek(30);
    await store.seekRelative(5);
    await store.setVolume(50);
    await store.toggleMute();
    await store.setSpeed(1.5);
    await store.setPreset("Mode B (HQ)");
    await store.toggleAnime4k();
    await store.closePlayer();

    const playerCommands = invokedCommands().filter(
      (command) => typeof command === "string" && command.startsWith("player_"),
    );
    expect(playerCommands).toEqual([]);
  });

  it("still persists volume, preset, quality, and hotkeys through db_save_setting", async () => {
    const store = usePlayerStore.getState();

    await store.setVolume(42);
    await store.setPreset("Mode C (HQ)");
    await store.toggleAnime4k();
    await store.setPreferredQuality("720p");
    await store.setHotkey("togglePlay", "KeyX");

    expect(invoke).toHaveBeenCalledWith("db_save_setting", { key: "volume", value: "42" });
    expect(invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "anime4k_preset",
      value: "Mode C (HQ)",
    });
    expect(invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "anime4k_enabled",
      value: "false",
    });
    expect(invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "preferred_quality",
      value: "720p",
    });
    expect(invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "hotkeys",
      value: expect.stringContaining('"togglePlay":"KeyX"'),
    });
  });
});
