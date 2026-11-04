import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import { playback } from "@/features/player/renderer/playbackSession";
import { PlayerOverlay } from "@/features/player/ui/PlayerOverlay";
import { PlaybackTab } from "@/features/settings/ui/PlaybackTab";
import type { EpisodeItem, Release } from "@/shared/types";
import {
  activeRenderer,
  FakeAnime4kRenderer,
  installWebGPU,
  resetEnhancementStub,
} from "./helpers/enhancementStubs";
import { installMediaElementStub, resetHlsStub, setMediaDuration } from "./helpers/playbackStubs";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => tauri.invoke(...(args as [])),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const episode: EpisodeItem = {
  id: "ep-1",
  ordinal: 1,
  name: "Серия 1",
  duration: 1440,
  hls_1080: "https://cache.test/videos/1/1/1080/x.m3u8",
};

const release: Release = {
  id: 1,
  name: { main: "Один кадр" },
  type: { value: "tv", description: "ТВ" },
  year: 2026,
  episodes_total: 1,
  poster: { src: "/poster.jpg" },
  episodes: [episode],
};

function Harness() {
  useEffect(() => {
    void usePlayerStore.getState().openPlayer(release, episode, 0);
  }, []);
  return (
    <PlayerOverlay release={release} episode={episode} onBack={() => {}} onGoToRelease={() => {}} />
  );
}

async function openPlayer() {
  const view = render(<Harness />);
  await act(async () => {});
  return {
    ...view,
    video: () => view.container.querySelector("video") as HTMLVideoElement,
    canvas: () => view.container.querySelector("canvas"),
  };
}

async function pressPresetKey(digit: string) {
  await act(async () => {
    fireEvent.keyDown(window, { code: `Digit${digit}`, shiftKey: true });
  });
}

/** The world every case here starts from: an open player, a stubbed media stack, no GPU. */
function resetEnhancementWorld(): void {
  playback.close();
  resetHlsStub();
  resetEnhancementStub();
  installMediaElementStub();
  setMediaDuration(1440);
  localStorage.clear();
  tauri.invoke.mockReset().mockResolvedValue(null);
  usePlayerStore.setState({
    isPlayerOpen: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    isMuted: false,
    speed: 1,
    anime4kEnabled: false,
    anime4kPreset: "Mode A (HQ)",
    enhancementFault: null,
    preferredQuality: "1080p",
    activeQuality: "1080p",
    autoplayNext: false,
    autoSkipOpEd: false,
    playbackError: null,
    currentRelease: null,
    currentEpisode: null,
  });
}

describe("Anime4K enhancement hotkeys", () => {
  beforeEach(resetEnhancementWorld);

  it("maps Shift+1..6 onto the six presets Settings offers, in the same order", async () => {
    await openPlayer();

    for (const [digit, preset] of [
      ["1", "Mode A (HQ)"],
      ["2", "Mode A+A (HQ)"],
      ["3", "Mode B (HQ)"],
      ["4", "Mode B+B (HQ)"],
      ["5", "Mode C (HQ)"],
      ["6", "Mode C+A (HQ)"],
    ]) {
      await pressPresetKey(digit);
      expect(usePlayerStore.getState().anime4kPreset).toBe(preset);
    }
  });

  it("switches the enhancement off with Shift+0 and saves that as a Setting", async () => {
    usePlayerStore.setState({ anime4kEnabled: true });
    await openPlayer();

    await act(async () => {
      fireEvent.keyDown(window, { code: "Digit0", shiftKey: true });
    });

    expect(usePlayerStore.getState().anime4kEnabled).toBe(false);
    expect(localStorage.getItem("aniplayer_anime4k_enabled")).toBe("false");
    expect(tauri.invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "anime4k_enabled",
      value: "false",
    });
  });
});

describe("Anime4K on a machine without WebGPU", () => {
  beforeEach(resetEnhancementWorld);

  it("explains the refusal in the player menu instead of promising a filtered frame", async () => {
    const { container } = await openPlayer();

    fireEvent.click(screen.getByTitle("Настройки плеера"));
    const upscaler = await screen.findByLabelText("Переключить апскейлер 4K");

    expect(upscaler.hasAttribute("disabled")).toBe(true);
    expect(upscaler.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/нужен webgpu/i)).toBeDefined();

    fireEvent.click(upscaler);
    await act(async () => {});

    expect(usePlayerStore.getState().anime4kEnabled).toBe(false);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("video")).not.toBeNull();
    // The rest of the menu is untouched: only the enhancement is out of order.
    const skipSwitch = screen.getByLabelText("Пропуск опенингов и эндингов");
    expect(skipSwitch.hasAttribute("disabled")).toBe(false);
  });

  it("does not let a preference saved on another machine pretend the frame is filtered", async () => {
    usePlayerStore.setState({ anime4kEnabled: true });

    const { container } = await openPlayer();

    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.queryByText("4K Upscale")).toBeNull();
    expect(container.querySelector("video")).not.toBeNull();

    fireEvent.click(screen.getByTitle("Настройки плеера"));
    const upscaler = await screen.findByLabelText("Переключить апскейлер 4K");
    expect(upscaler.getAttribute("aria-checked")).toBe("false");
    expect(upscaler.hasAttribute("disabled")).toBe(true);
  });

  it("says the same thing in Settings, where the preset list still stays selectable", () => {
    render(<PlaybackTab />);

    const upscaler = screen.getByLabelText("Переключить апскейлер Anime4K");
    expect(upscaler.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/нужен webgpu/i)).toBeDefined();
    expect(screen.getByText("Mode C+A (HQ)")).toBeDefined();
  });
});

describe("Applying the enhancement to a live Episode", () => {
  beforeEach(() => {
    resetEnhancementWorld();
    installWebGPU();
  });

  it("takes the live frame into the renderer and shows the rendered canvas in its place", async () => {
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode B+B (HQ)" });

    const { canvas, video } = await openPlayer();
    await waitFor(() => expect(canvas()).not.toBeNull());

    const renderer = activeRenderer();
    expect(renderer?.video).toBe(video());
    expect(renderer?.canvas).toBe(canvas());
    expect(renderer?.preset).toBe("Mode B+B (HQ)");
    expect(renderer?.started).toBe(true);
    expect(video().className).toContain("opacity-0");
    expect(screen.getByText("4K Upscale")).toBeDefined();
  });

  it("rebuilds the renderer on the same canvas when the preset changes mid-playback", async () => {
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode A (HQ)" });

    const { canvas, video } = await openPlayer();
    await waitFor(() => expect(canvas()).not.toBeNull());
    const first = activeRenderer();
    const firstCanvas = canvas();

    await act(async () => {
      await usePlayerStore.getState().setAnime4kPreset("Mode C+A (HQ)");
    });
    await waitFor(() => expect(activeRenderer()).not.toBe(first));

    expect(first?.preset).toBe("Mode A (HQ)");
    expect(first?.stopped).toBe(true);
    expect(activeRenderer()?.preset).toBe("Mode C+A (HQ)");
    expect(activeRenderer()?.started).toBe(true);
    expect(canvas()).toBe(firstCanvas);
    expect(video().className).toContain("opacity-0");
  });

  it("stops the renderer and hands the frame back to the element when switched off", async () => {
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode A+A (HQ)" });

    const { canvas, video } = await openPlayer();
    await waitFor(() => expect(canvas()).not.toBeNull());
    const renderer = activeRenderer();

    await act(async () => {
      await usePlayerStore.getState().setAnime4kEnabled(false);
    });

    expect(renderer?.stopped).toBe(true);
    expect(canvas()).toBeNull();
    expect(video().className).not.toContain("opacity-0");
    expect(screen.queryByText("4K Upscale")).toBeNull();
  });

  it("switches back on with the preset it was switched off from, on the live session", async () => {
    const { canvas, video } = await openPlayer();
    expect(canvas()).toBeNull();

    await act(async () => {
      await usePlayerStore.getState().setAnime4kEnabled(true);
    });
    await waitFor(() => expect(canvas()).not.toBeNull());

    expect(activeRenderer()?.preset).toBe("Mode A (HQ)");
    expect(activeRenderer()?.video).toBe(video());
  });

  it("keeps playing, seeking and switching Quality while the frame is filtered", async () => {
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode A (HQ)" });

    const { canvas, video } = await openPlayer();
    await waitFor(() => expect(canvas()).not.toBeNull());

    await act(async () => {
      await usePlayerStore.getState().seekTo(420);
    });
    expect(video().currentTime).toBe(420);

    await act(async () => {
      await usePlayerStore.getState().pause();
    });
    expect(video().paused).toBe(true);

    await act(async () => {
      await usePlayerStore.getState().play();
    });
    expect(video().paused).toBe(false);

    expect(canvas()).not.toBeNull();
    expect(activeRenderer()?.stopped).toBe(false);
  });

  it("falls back to the element and explains a renderer that never came up", async () => {
    FakeAnime4kRenderer.failNextWith = "WebGPU-адаптер не отдан машине";
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode A (HQ)" });

    const { canvas, video } = await openPlayer();
    await waitFor(() => expect(activeRenderer()).toBeDefined());

    expect(usePlayerStore.getState().enhancementFault).toBe("WebGPU-адаптер не отдан машине");
    await waitFor(() => expect(canvas()).toBeNull());
    expect(video().className).not.toContain("opacity-0");
    expect(screen.queryByText("4K Upscale")).toBeNull();
  });
});
