import { describe, expect, it, vi } from "vitest";
import { ANIME4K_PRESETS } from "@/features/player";

// This case exists to reach the real package; every other test drives the stubbed boundary.
vi.unmock("@/features/player/renderer/anime4kRenderer");

async function loadRenderer() {
  return import("@/features/player/renderer/anime4kRenderer");
}

describe("Anime4K preset mapping", () => {
  it("builds a distinct pipeline for every preset Settings offers", async () => {
    const { resolvePresetPipeline } = await loadRenderer();

    const pipelines = ANIME4K_PRESETS.map((preset) => resolvePresetPipeline(preset.id));

    expect(new Set(pipelines).size).toBe(ANIME4K_PRESETS.length);
  });

  it("answers a name the package does not ship with the default pipeline", async () => {
    const { resolvePresetPipeline } = await loadRenderer();

    expect(resolvePresetPipeline("Mode Fast (APU)")).toBe(resolvePresetPipeline("Mode A+A (HQ)"));
  });
});
