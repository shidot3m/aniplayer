import {
  type Anime4KPipeline,
  type Anime4KPresetPipelineDescriptor,
  ModeA,
  ModeAA,
  ModeB,
  ModeBB,
  ModeC,
  ModeCA,
} from "anime4k-webgpu";
import { ANIME4K_PRESETS, DEFAULT_ANIME4K_PRESET } from "../state/playerStoreDefaults";

export type PipelineConstructor = new (
  descriptor: Anime4KPresetPipelineDescriptor,
) => Anime4KPipeline;

/** The six presets, each mapped to the pipeline the package actually ships for it. */
const PRESET_MAP: Record<string, PipelineConstructor> = {
  "Mode A (HQ)": ModeA,
  "Mode A+A (HQ)": ModeAA,
  "Mode B (HQ)": ModeB,
  "Mode B+B (HQ)": ModeBB,
  "Mode C (HQ)": ModeC,
  "Mode C+A (HQ)": ModeCA,
};

export function resolvePresetPipeline(preset: string): PipelineConstructor {
  return PRESET_MAP[preset] ?? PRESET_MAP[DEFAULT_ANIME4K_PRESET];
}

/** Every preset Settings offers has a pipeline here, and nothing here is offered without one. */
export function pipelinesCoverPresets(): boolean {
  return (
    ANIME4K_PRESETS.every((preset) => preset.id in PRESET_MAP) &&
    Object.keys(PRESET_MAP).every((id) => ANIME4K_PRESETS.some((preset) => preset.id === id))
  );
}

const QUAD_WGSL = `
  @vertex
  fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
      vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2(-1.0,  1.0),
      vec2(-1.0,  1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0)
    );
    let p = pos[VertexIndex];
    return vec4<f32>(p.x, p.y, 0.0, 1.0);
  }

  @group(0) @binding(0) var mySampler: sampler;
  @group(0) @binding(1) var myTexture: texture_2d<f32>;

  @fragment
  fn frag_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
    let dims = textureDimensions(myTexture);
    let uv = vec2<f32>(coord.x / f32(dims.x), coord.y / f32(dims.y));
    return textureSample(myTexture, mySampler, uv);
  }
`;

/**
 * Draws every frame the media element presents through an Anime4K pipeline and into the
 * overlay canvas. The element keeps decoding and playing sound; only its picture is replaced.
 *
 * `start` resolves once the first filtered frame is on the canvas, so the surface can keep the
 * element visible until there is something to paint over it, and rejects with the reason the
 * frame cannot be taken, so it falls back rather than holding a canvas that never paints.
 */
export class Anime4kRenderer {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly preset: string;

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";
  private inputTexture: GPUTexture | null = null;
  private pipeline: Anime4KPipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private sampler: GPUSampler | null = null;
  private animationFrameId = 0;
  private videoFrameCallbackId = 0;
  private destroyed = false;
  private forceRender = true;
  private targetChanged = false;
  private firstFrameResolve: (() => void) | null = null;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, preset: string) {
    this.video = video;
    this.canvas = canvas;
    this.preset = preset;
  }

  start(): Promise<void> {
    const painted = new Promise<void>((resolve) => {
      this.firstFrameResolve = resolve;
    });
    return this.connect().then(() => painted);
  }

  private async connect(): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("WebGPU-адаптер не отдан машине");

    const context = this.canvas.getContext("webgpu");
    if (!context) throw new Error("Canvas не принимает WebGPU");

    const device = await adapter.requestDevice();
    if (this.destroyed) throw new Error("Рендерер остановлен до запуска");
    this.device = device;
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: this.format, alphaMode: "premultiplied" });

    window.addEventListener("resize", this.onResize);
    this.video.addEventListener("seeked", this.onSeeked);
    this.startLoops();
  }

  stop(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrameId);
    if (this.videoFrameCallbackId && typeof this.video.cancelVideoFrameCallback === "function") {
      this.video.cancelVideoFrameCallback(this.videoFrameCallbackId);
    }
    window.removeEventListener("resize", this.onResize);
    this.video.removeEventListener("seeked", this.onSeeked);
    this.inputTexture?.destroy();
    this.inputTexture = null;
    this.pipeline = null;
    this.device?.destroy();
    this.device = null;
    // A start() still waiting for its first frame must not stay waiting on a renderer
    // that no longer exists.
    this.settleFirstFrame();
  }

  private settleFirstFrame(): void {
    const resolve = this.firstFrameResolve;
    this.firstFrameResolve = null;
    resolve?.();
  }

  private onResize = (): void => {
    this.targetChanged = true;
    this.forceRender = true;
  };

  private onSeeked = (): void => {
    this.forceRender = true;
  };

  private startLoops(): void {
    this.animationFrameId = requestAnimationFrame(this.checkFrame);
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.videoFrameCallbackId = this.video.requestVideoFrameCallback(this.onVideoFrame);
    }
  }

  /**
   * With a video-frame callback the presented frame drives the draw, which is what keeps the
   * picture on the audio clock; without one, a playing element redraws every animation frame.
   */
  private checkFrame = (): void => {
    if (this.destroyed) return;

    const hasVideoFrameCallback = typeof this.video.requestVideoFrameCallback === "function";
    const shouldRender = this.forceRender || (!hasVideoFrameCallback && !this.video.paused);
    if (shouldRender && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      this.renderFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.checkFrame);
  };

  private onVideoFrame = (): void => {
    if (this.destroyed) return;
    this.renderFrame();
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.videoFrameCallbackId = this.video.requestVideoFrameCallback(this.onVideoFrame);
    }
  };

  private renderFrame(): void {
    const device = this.device;
    const context = this.context;
    if (!device || !context || !this.ensureResources()) return;

    const inputTexture = this.inputTexture;
    const pipeline = this.pipeline;
    const renderPipeline = this.renderPipeline;
    const bindGroup = this.bindGroup;
    if (!inputTexture || !pipeline || !renderPipeline || !bindGroup) return;

    device.queue.copyExternalImageToTexture({ source: this.video }, { texture: inputTexture }, [
      this.video.videoWidth,
      this.video.videoHeight,
      1,
    ]);

    const encoder = device.createCommandEncoder();
    pipeline.pass(encoder);

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();

    device.queue.submit([encoder.finish()]);
    this.forceRender = false;
    this.targetChanged = false;
    this.settleFirstFrame();
  }

  private ensureResources(): boolean {
    const device = this.device;
    if (!device) return false;

    const needsRebuild =
      !this.inputTexture ||
      this.inputTexture.width !== this.video.videoWidth ||
      this.inputTexture.height !== this.video.videoHeight ||
      (this.targetChanged && this.pipeline !== null);
    if (needsRebuild) {
      this.createPipeline(device);
    }

    return this.inputTexture !== null && this.pipeline !== null;
  }

  private createPipeline(device: GPUDevice): void {
    this.inputTexture?.destroy();

    const inputTexture = device.createTexture({
      size: [this.video.videoWidth, this.video.videoHeight, 1],
      format: "rgba16float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.inputTexture = inputTexture;

    const PipelineClass = resolvePresetPipeline(this.preset);
    this.pipeline = new PipelineClass({
      device,
      inputTexture,
      nativeDimensions: {
        width: this.video.videoWidth,
        height: this.video.videoHeight,
      },
      targetDimensions: this.getTargetDimensions(),
    });

    const outputTexture = this.pipeline.getOutputTexture();
    this.canvas.width = outputTexture.width;
    this.canvas.height = outputTexture.height;
    this.setupRenderPipeline(device, outputTexture);
  }

  private getTargetDimensions(): { width: number; height: number } {
    const displayWidth = this.canvas.clientWidth || window.innerWidth;
    const displayHeight = this.canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    return {
      width: Math.max(this.video.videoWidth, Math.floor(displayWidth * dpr)),
      height: Math.max(this.video.videoHeight, Math.floor(displayHeight * dpr)),
    };
  }

  private setupRenderPipeline(device: GPUDevice, outputTexture: GPUTexture): void {
    if (!this.renderPipeline) {
      const module = device.createShaderModule({ code: QUAD_WGSL });
      this.renderPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vert_main" },
        fragment: {
          module,
          entryPoint: "frag_main",
          targets: [{ format: this.format }],
        },
        primitive: { topology: "triangle-list" },
      });
      this.sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      });
    }

    const sampler = this.sampler;
    if (!sampler) return;

    this.bindGroup = device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: outputTexture.createView() },
      ],
    });
  }
}
