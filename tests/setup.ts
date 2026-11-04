import { vi } from "vitest";

/**
 * The playback seam every test renders against: hls.js is the module the player feature uses
 * to reach the media stack, so it is stubbed once here instead of in each file. Tests import
 * `FakeHls` from the same helper to look at what was loaded and to emit its events.
 */
vi.mock("hls.js", () => import("./helpers/playbackStubs").then((m) => ({ default: m.FakeHls })));

/**
 * The other boundary the player feature reaches: the WebGPU renderer chunk. Tests import
 * `FakeAnime4kRenderer` to see which element and preset were handed to the GPU and whether
 * switching the enhancement off stopped it.
 */
vi.mock("@/features/player/renderer/anime4kRenderer", () =>
  import("./helpers/enhancementStubs").then((m) => ({ Anime4kRenderer: m.FakeAnime4kRenderer })),
);
