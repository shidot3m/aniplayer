import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ANIME4K_PRESETS, usePlayerStore } from "@/features/player";
import { PlaybackTab } from "../src/components/settings/PlaybackTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("Anime4K Presets Specification", () => {
  it("contains all 7 official Anime4K v4 presets with labels and descriptions", () => {
    expect(ANIME4K_PRESETS).toHaveLength(7);
    const ids = ANIME4K_PRESETS.map((p) => p.id);
    expect(ids).toContain("Mode A (HQ)");
    expect(ids).toContain("Mode A+A (HQ)");
    expect(ids).toContain("Mode B (HQ)");
    expect(ids).toContain("Mode B+B (HQ)");
    expect(ids).toContain("Mode C (HQ)");
    expect(ids).toContain("Mode C+A (HQ)");
    expect(ids).toContain("Mode Fast (APU)");

    for (const preset of ANIME4K_PRESETS) {
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(["HQ", "Fast"]).toContain(preset.tier);
    }
  });

  it("renders all 7 presets with descriptions in PlaybackTab and selects preset", () => {
    usePlayerStore.setState({
      anime4kEnabled: true,
      anime4kPreset: "Mode A+A (HQ)",
    });

    render(<PlaybackTab />);

    expect(screen.getByText("Mode A+A (HQ)")).toBeDefined();
    expect(screen.getByText("Mode A (HQ)")).toBeDefined();
    expect(screen.getByText("Mode B (HQ)")).toBeDefined();
    expect(screen.getByText("Mode B+B (HQ)")).toBeDefined();
    expect(screen.getByText("Mode C (HQ)")).toBeDefined();
    expect(screen.getByText("Mode C+A (HQ)")).toBeDefined();
    expect(screen.getByText("Mode Fast (APU)")).toBeDefined();

    // Click Mode Fast (APU)
    const fastBtn = screen.getByText("Mode Fast (APU)").closest("button");
    expect(fastBtn).toBeDefined();
    if (!fastBtn) throw new Error("Mode Fast button not found");
    fireEvent.click(fastBtn);

    expect(usePlayerStore.getState().anime4kPreset).toBe("Mode Fast (APU)");
  });
});
