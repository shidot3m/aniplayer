import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ANIME4K_PRESETS, usePlayerStore } from "@/features/player";
import { getInitialAnime4kPreset } from "@/features/player/state/playerStoreDefaults";
import { PlaybackTab } from "@/features/settings/ui/PlaybackTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("Anime4K preset list", () => {
  it("offers the six presets that exist, and no invented alias", () => {
    expect(ANIME4K_PRESETS.map((preset) => preset.id)).toEqual([
      "Mode A (HQ)",
      "Mode A+A (HQ)",
      "Mode B (HQ)",
      "Mode B+B (HQ)",
      "Mode C (HQ)",
      "Mode C+A (HQ)",
    ]);
  });

  it("describes every preset the list offers", () => {
    for (const preset of ANIME4K_PRESETS) {
      expect(preset.label, preset.id).toBeTruthy();
      expect(preset.description, preset.id).toBeTruthy();
    }
  });

  it("renders all six in Settings and applies a click to the live Setting", () => {
    usePlayerStore.setState({ anime4kEnabled: true, anime4kPreset: "Mode A+A (HQ)" });

    render(<PlaybackTab />);

    const ids = ANIME4K_PRESETS.map((preset) => preset.id);
    expect(screen.getAllByRole("button", { name: /^Mode / })).toHaveLength(ids.length);
    expect(screen.queryByText(/APU/i)).toBeNull();

    fireEvent.click(screen.getByText("Mode B (HQ)"));

    expect(usePlayerStore.getState().anime4kPreset).toBe("Mode B (HQ)");
  });

  it("comes back as a real preset when a stored one names a mode that does not exist", () => {
    localStorage.setItem("aniplayer_anime4k_preset", "Mode Fast (APU)");

    expect(getInitialAnime4kPreset()).toBe("Mode A+A (HQ)");
  });
});
