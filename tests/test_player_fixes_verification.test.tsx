import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import { getInitialAnime4kPreset } from "@/features/player/state/playerStoreDefaults";
import { PlaybackTab } from "@/features/settings/ui/PlaybackTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Player and upscaler fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("updates Play/Pause state without touching the backend", async () => {
    usePlayerStore.setState({ isPlaying: false });

    await usePlayerStore.getState().play();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await usePlayerStore.getState().pause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    expect(invoke).not.toHaveBeenCalled();
  });

  it("persists the upscaler preset to localStorage and db_save_setting, even when disabled", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    usePlayerStore.setState({
      anime4kEnabled: false,
      anime4kPreset: "Mode A+A (HQ)",
    });

    render(<PlaybackTab />);

    // Click Mode B+B button even while anime4k is disabled
    const bbBtn = screen.getByText("Mode B+B (HQ)").closest("button");
    expect(bbBtn).toBeDefined();
    expect(bbBtn?.hasAttribute("disabled")).toBe(false);

    if (!bbBtn) throw new Error("Mode B+B button not found");
    fireEvent.click(bbBtn);

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
});
