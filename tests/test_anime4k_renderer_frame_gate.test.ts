import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Anime4kRenderer } from "@/features/player/renderer/anime4kRenderer";

const { FRAME_WIDTH, FRAME_HEIGHT } = vi.hoisted(() => ({ FRAME_WIDTH: 640, FRAME_HEIGHT: 360 }));

// The seam under test is the renderer itself, driven against a fake GPU device: the question is
// whether a frame the element does not have can reach copyExternalImageToTexture.
vi.unmock("@/features/player/renderer/anime4kRenderer");

vi.mock("anime4k-webgpu", () => {
  class FakePipeline {
    readonly pass = vi.fn();
    readonly getOutputTexture = () => ({
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      createView: () => ({}),
    });
  }
  return {
    ModeA: FakePipeline,
    ModeAA: FakePipeline,
    ModeB: FakePipeline,
    ModeBB: FakePipeline,
    ModeC: FakePipeline,
    ModeCA: FakePipeline,
  };
});

interface FakeGpu {
  copyExternalImageToTexture: ReturnType<typeof vi.fn>;
  createTexture: ReturnType<typeof vi.fn>;
}

function installGpu(): FakeGpu {
  const copyExternalImageToTexture = vi.fn();
  const createTexture = vi.fn(() => ({
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    destroy: vi.fn(),
  }));
  const pass = { setPipeline: vi.fn(), setBindGroup: vi.fn(), draw: vi.fn(), end: vi.fn() };
  const device = {
    queue: { copyExternalImageToTexture, submit: vi.fn() },
    createTexture,
    createShaderModule: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    createSampler: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(() => ({
      beginRenderPass: vi.fn(() => pass),
      finish: vi.fn(() => ({})),
    })),
    destroy: vi.fn(),
  };
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: vi.fn(async () => ({ requestDevice: vi.fn(async () => device) })),
      getPreferredCanvasFormat: () => "bgra8unorm",
    },
  });
  return { copyExternalImageToTexture, createTexture };
}

interface MediaState {
  readyState: number;
  videoWidth: number;
  videoHeight: number;
}

/** A video element whose media properties the test owns; jsdom never decodes anything. */
function createVideo(state: MediaState): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { configurable: true, get: () => state.readyState },
    videoWidth: { configurable: true, get: () => state.videoWidth },
    videoHeight: { configurable: true, get: () => state.videoHeight },
  });
  return video;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getContext", {
    configurable: true,
    value: vi.fn(() => ({
      configure: vi.fn(),
      getCurrentTexture: () => ({ createView: () => ({}) }),
    })),
  });
  return canvas;
}

describe("Anime4K renderer frame gate", () => {
  const pendingFrames: FrameRequestCallback[] = [];
  const renderers: Anime4kRenderer[] = [];
  const pendingStarts: Promise<void>[] = [];
  let gpu: FakeGpu;

  function pumpAnimationFrame(): void {
    for (const callback of pendingFrames.splice(0)) callback(performance.now());
  }

  async function startRenderer(state: MediaState): Promise<void> {
    const { Anime4kRenderer } = await import("@/features/player/renderer/anime4kRenderer");
    const video = createVideo(state);
    const renderer = new Anime4kRenderer(video, createCanvas(), "Mode A (HQ)");
    renderers.push(renderer);
    pendingStarts.push(renderer.start());
    await vi.waitFor(() => {
      if (pendingFrames.length === 0) throw new Error("render loop was not scheduled");
    });
  }

  beforeEach(() => {
    pendingFrames.length = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      pendingFrames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("GPUTextureUsage", { TEXTURE_BINDING: 4, COPY_DST: 2, RENDER_ATTACHMENT: 16 });
    gpu = installGpu();
  });

  afterEach(async () => {
    for (const renderer of renderers.splice(0)) renderer.stop();
    await Promise.allSettled(pendingStarts.splice(0));
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "gpu");
  });

  it("does not copy a texture while the element has no frame", async () => {
    // A tick can outrun the element — at a source swap, after a buffer eviction or a seek —
    // while the previous dimensions are still reported; the copy would throw exactly there.
    const state: MediaState = { readyState: 0, videoWidth: FRAME_WIDTH, videoHeight: FRAME_HEIGHT };
    await startRenderer(state);

    pumpAnimationFrame();

    expect(gpu.copyExternalImageToTexture).not.toHaveBeenCalled();
    expect(gpu.createTexture).not.toHaveBeenCalled();
  });

  it("copies the frame once the element reports one", async () => {
    const state: MediaState = { readyState: 0, videoWidth: FRAME_WIDTH, videoHeight: FRAME_HEIGHT };
    await startRenderer(state);

    pumpAnimationFrame();
    state.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
    pumpAnimationFrame();

    expect(gpu.copyExternalImageToTexture).toHaveBeenCalledTimes(1);
  });
});
