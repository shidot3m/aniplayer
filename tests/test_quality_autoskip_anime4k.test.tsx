import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeekBar } from "../src/components/player/SeekBar";
import {
  getAvailableQualities,
  resolveEpisodeQuality,
} from "../src/store/playerStoreDefaults";
import type { EpisodeItem } from "../src/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Quality Selection & Clamping", () => {
  it("only returns qualities present in episode data and clamps 1080p if unavailable", () => {
    const ep720Only: EpisodeItem = {
      id: 1,
      name: "Episode 1",
      ordinal: 1,
      hls_720: "https://example.com/720.m3u8",
      hls_480: "https://example.com/480.m3u8",
      // hls_1080 is undefined
    };

    const available = getAvailableQualities(ep720Only);
    expect(available).toEqual(["720p", "480p"]);
    expect(available).not.toContain("1080p");

    // When user's preferred quality is 1080p, it must fallback to highest available (720p)
    const resolved = resolveEpisodeQuality(ep720Only, "1080p");
    expect(resolved).toBe("720p");
  });

  it("returns 1080p when 1080p stream exists", () => {
    const ep1080: EpisodeItem = {
      id: 2,
      name: "Episode 2",
      ordinal: 2,
      hls_1080: "https://example.com/1080.m3u8",
      hls_720: "https://example.com/720.m3u8",
      hls_480: "https://example.com/480.m3u8",
    };

    const available = getAvailableQualities(ep1080);
    expect(available).toEqual(["1080p", "720p", "480p"]);
    expect(resolveEpisodeQuality(ep1080, "1080p")).toBe("1080p");
  });
});

describe("SeekBar Timeline Markers (OP/ED)", () => {
  it("renders opening (amber) and ending (indigo) timeline markers with tooltips", () => {
    const { container } = render(
      <SeekBar
        currentTime={100}
        duration={1440} // 24 minutes
        opening={{ start: 60, stop: 150 }}
        ending={{ start: 1300, stop: 1390 }}
        onSeek={vi.fn()}
      />,
    );

    // Opening block (amber-400)
    const opBlock = container.querySelector(".bg-amber-400\\/80");
    expect(opBlock).toBeDefined();
    expect(opBlock?.getAttribute("title")).toBe("Опенинг");

    // Ending block (indigo-400)
    const edBlock = container.querySelector(".bg-indigo-400\\/80");
    expect(edBlock).toBeDefined();
    expect(edBlock?.getAttribute("title")).toBe("Эндинг");
  });
});

describe("Anime4K Shader & Upscaler Validation", () => {
  it("contains authentic Anime4K algorithms: Catmull-Rom, Clamp Highlights, and edge-directed reconstruction", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const shaderCode = fs.readFileSync(
      path.resolve(__dirname, "../src/components/player/Anime4kCanvas.tsx"),
      "utf-8",
    );

    // Smooth subpixel upscale
    expect(shaderCode).toContain("sampleBicubic");
    expect(shaderCode).toContain("w0 = -0.5 * f3 + f2 - 0.5 * f");

    // Clamp Highlights
    expect(shaderCode).toContain("minCol = min(c, min(min(tl, tr), min(bl, br)))");
    expect(shaderCode).toContain("maxCol = max(c, max(max(tl, tr), max(bl, br)))");

    // Line Thinning & Deblur
    expect(shaderCode).toContain("edgeWeight = smoothstep(0.04, 0.14, edgeLen)");
    expect(shaderCode).toContain("dog * sharpenStrength * edgeWeight");

    // Display resolution render target up to 4K
    expect(shaderCode).toContain("Math.min(3840, Math.max(video.videoWidth");
    expect(shaderCode).toContain("Math.min(2160, Math.max(video.videoHeight");

    // Zero context teardown on preset change
    expect(shaderCode).toContain("presetRef.current = preset");
  });
});
