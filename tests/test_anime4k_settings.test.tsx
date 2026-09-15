import { describe, expect, it } from "vitest";
import { ANIME4K_PRESETS } from "../src/store/playerStoreDefaults";

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
});
