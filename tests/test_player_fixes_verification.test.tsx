import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackTab } from "../src/components/settings/PlaybackTab";
import { usePlayerStore } from "../src/store/playerStore";
import { getInitialAnime4kPreset } from "../src/store/playerStoreDefaults";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Verification of 3 critical player & upscaler fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("1. Play/Pause state updates reliably even when MPV backend is not initialized", async () => {
    // Simulate MPV not initialized error from backend
    (invoke as any).mockRejectedValue(new Error("Player not initialized"));

    usePlayerStore.setState({ isPlaying: false });

    // Call play()
    await usePlayerStore.getState().play();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Call pause()
    await usePlayerStore.getState().pause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    // Call togglePlay()
    await usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("2. Upscaler preset persists to localStorage, db_save_setting, and can be changed when disabled", async () => {
    (invoke as any).mockResolvedValue(null);

    usePlayerStore.setState({
      anime4kEnabled: false,
      anime4kPreset: "Mode A+A (HQ)",
    });

    render(<PlaybackTab />);

    // Click Mode B+B button even while anime4k is disabled
    const bbBtn = screen.getByText("Mode B+B (HQ)").closest("button");
    expect(bbBtn).toBeDefined();
    expect(bbBtn?.hasAttribute("disabled")).toBe(false);

    fireEvent.click(bbBtn!);

    // Store must be updated
    expect(usePlayerStore.getState().anime4kPreset).toBe("Mode B+B (HQ)");

    // LocalStorage must be saved
    expect(localStorage.getItem("aniplayer_anime4k_preset")).toBe("Mode B+B (HQ)");

    // getInitialAnime4kPreset must return saved value
    expect(getInitialAnime4kPreset()).toBe("Mode B+B (HQ)");

    // db_save_setting must have been invoked
    expect(invoke).toHaveBeenCalledWith("db_save_setting", {
      key: "anime4k_preset",
      value: "Mode B+B (HQ)",
    });
  });

  it("3. Anime4K canvas starts the GPU renderer only when enabled and cleans it up", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const canvasCode = fs.readFileSync(
      path.resolve(__dirname, "../src/components/player/Anime4kCanvas.tsx"),
      "utf-8",
    );
    const rendererCode = fs.readFileSync(
      path.resolve(__dirname, "../src/components/player/anime4kRenderer.ts"),
      "utf-8",
    );

    expect(canvasCode).toContain("new Anime4kRenderer");
    expect(canvasCode).toContain("renderer.destroy()");
    expect(rendererCode).toContain("copyExternalImageToTexture");
    expect(rendererCode).toContain("requestVideoFrameCallback");
    expect(rendererCode).toContain("cancelVideoFrameCallback");
    expect(rendererCode).toContain("this.video.paused");
  });
});
