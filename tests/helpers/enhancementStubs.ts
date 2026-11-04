import { vi } from "vitest";

/**
 * The seam between the player and the WebGPU stack. `anime4kRenderer` is the module the
 * enhancement feature uses to reach the GPU, so stubbing it keeps the tests on the public
 * boundary: which element was handed over, which preset was asked for, and whether the
 * renderer was stopped when the user switched the enhancement off.
 */
class FakeAnime4kRenderer {
  static readonly instances: FakeAnime4kRenderer[] = [];
  /** When set, the next renderer fails to start, the way a refused adapter does. */
  static failNextWith: string | null = null;
  /** When set, the next renderer's start waits for a painted frame, the way the real one does. */
  static blocksNextPaint = false;

  readonly video: HTMLVideoElement;
  readonly canvas: HTMLCanvasElement;
  readonly preset: string;
  started = false;
  stopped = false;
  private paintResolve: () => void = () => {};

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, preset: string) {
    this.video = video;
    this.canvas = canvas;
    this.preset = preset;
    FakeAnime4kRenderer.instances.push(this);
  }

  readonly start = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        const failure = FakeAnime4kRenderer.failNextWith;
        if (failure) {
          FakeAnime4kRenderer.failNextWith = null;
          throw new Error(failure);
        }
        if (FakeAnime4kRenderer.blocksNextPaint) {
          FakeAnime4kRenderer.blocksNextPaint = false;
          this.paintResolve = resolve;
          return;
        }
        this.started = true;
        resolve();
      }),
  );

  /** The first filtered frame reached the canvas. */
  readonly paint = vi.fn((): void => {
    this.started = true;
    this.paintResolve();
  });

  readonly stop = vi.fn((): void => {
    this.stopped = true;
    this.paintResolve();
  });
}

/** The machine reports a WebGPU-capable webview. */
export function installWebGPU(): void {
  Object.defineProperty(navigator, "gpu", { value: {}, configurable: true });
}

export function removeWebGPU(): void {
  Reflect.deleteProperty(navigator, "gpu");
}

export function resetEnhancementStub(): void {
  FakeAnime4kRenderer.instances.length = 0;
  FakeAnime4kRenderer.failNextWith = null;
  FakeAnime4kRenderer.blocksNextPaint = false;
  removeWebGPU();
}

/** The next renderer only resolves `start` once {@link paintRendererFrame} is called. */
export function blockNextRendererPaint(): void {
  FakeAnime4kRenderer.blocksNextPaint = true;
}

export function paintRendererFrame(): void {
  FakeAnime4kRenderer.instances[FakeAnime4kRenderer.instances.length - 1]?.paint();
}

/** The renderer the overlay is driving now, i.e. the last one constructed. */
export function activeRenderer(): FakeAnime4kRenderer | undefined {
  return FakeAnime4kRenderer.instances[FakeAnime4kRenderer.instances.length - 1];
}

export { FakeAnime4kRenderer };
