import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getAvailableQualities,
  resolveEpisodeQuality,
} from "@/features/player/state/playerStoreDefaults";
import { SeekBar } from "@/features/player/ui/SeekBar";
import type { EpisodeItem } from "../src/shared/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Quality Selection & Clamping", () => {
  it("only returns qualities present in episode data and clamps 1080p if unavailable", () => {
    const ep720Only: EpisodeItem = {
      id: "1",
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
      id: "2",
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

describe("SeekBar timeline markers (OP/ED)", () => {
  it("marks the opening and the ending on the bar and names each in its tooltip", () => {
    const { container } = render(
      <SeekBar
        currentTime={100}
        duration={1440} // 24 minutes
        opening={{ start: 60, stop: 150 }}
        ending={{ start: 1300, stop: 1390 }}
        onSeek={vi.fn()}
      />,
    );

    // Queried by the marker's own test id, not by a colour class: which token paints a segment
    // is a design decision (ADR 0018), that the segment is there at all is the behaviour.
    const opBlock = container.querySelector('[data-testid="seekbar-opening-marker"]');
    expect(opBlock).toBeDefined();
    expect(opBlock?.getAttribute("title")).toBe("Опенинг");

    const edBlock = container.querySelector('[data-testid="seekbar-ending-marker"]');
    expect(edBlock).toBeDefined();
    expect(edBlock?.getAttribute("title")).toBe("Эндинг");
  });
});
