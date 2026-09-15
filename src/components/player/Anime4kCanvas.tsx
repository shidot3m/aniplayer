import React, { useEffect, useRef } from "react";
import { ModeA, ModeAA, ModeB, ModeBB, ModeC, ModeCA } from "anime4k-webgpu";

interface Anime4kCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  preset: string;
}

const PRESET_MAP: Record<string, any> = {
  "Mode A (HQ)": ModeA,
  "Mode A+A (HQ)": ModeAA,
  "Mode B (HQ)": ModeB,
  "Mode B+B (HQ)": ModeBB,
  "Mode C (HQ)": ModeC,
  "Mode C+A (HQ)": ModeCA,
  "Mode Fast (APU)": ModeA, // anime4k-webgpu uses ModeA as fallback for fast
};

const QUAD_WGSL = `
  @vertex
  fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
      vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2(-1.0,  1.0),
      vec2(-1.0,  1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0)
    );
    // WebGPU clip space Y is up, but textures are Y down. 
    // We can invert Y here to display upright.
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

export function Anime4kCanvas({ videoRef, enabled, preset }: Anime4kCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    let isDestroyed = false;
    let rAFId = 0;
    let vFCId = 0;

    (async () => {
      try {
        if (!navigator.gpu) {
          console.error("WebGPU is not supported by your browser/webview.");
          return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return;

        const device = await adapter.requestDevice();
        if (isDestroyed) return;

        const context = canvas.getContext("webgpu");
        if (!context) return;

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: "premultiplied" });

        const PipelineClass = PRESET_MAP[preset] || ModeAA;

        let inputTexture: GPUTexture | null = null;
        let pipelineInstance: any = null;

        let renderPipeline: GPURenderPipeline | null = null;
        let bindGroup: GPUBindGroup | null = null;
        let sampler: GPUSampler | null = null;

        const setupRenderPipeline = (outTex: GPUTexture) => {
          if (!renderPipeline) {
            const module = device.createShaderModule({ code: QUAD_WGSL });
            renderPipeline = device.createRenderPipeline({
              layout: "auto",
              vertex: { module, entryPoint: "vert_main" },
              fragment: {
                module,
                entryPoint: "frag_main",
                targets: [{ format }],
              },
              primitive: { topology: "triangle-list" },
            });
            sampler = device.createSampler({
              magFilter: "linear",
              minFilter: "linear",
            });
          }

          bindGroup = device.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler! },
              { binding: 1, resource: outTex.createView() },
            ],
          });
        };

        let forceRender = true;

        const renderWebGPU = () => {
          if (isDestroyed) return;
          if (video.videoWidth === 0 || video.videoHeight === 0) return;

          // Initialize or resize textures
          if (
            !inputTexture ||
            inputTexture.width !== video.videoWidth ||
            inputTexture.height !== video.videoHeight
          ) {
            if (inputTexture) inputTexture.destroy();
            inputTexture = device.createTexture({
              size: [video.videoWidth, video.videoHeight, 1],
              format: "rgba16float",
              usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            });

            const nativeDimensions = { width: video.videoWidth, height: video.videoHeight };

            // Calculate target dimensions based on canvas CSS size or window, falling back to native if 0
            const displayWidth = canvas.clientWidth || window.innerWidth;
            const displayHeight = canvas.clientHeight || window.innerHeight;
            const dpr = window.devicePixelRatio || 1;

            const targetDimensions = {
              width: Math.max(video.videoWidth, Math.floor(displayWidth * dpr)),
              height: Math.max(video.videoHeight, Math.floor(displayHeight * dpr)),
            };

            pipelineInstance = new PipelineClass({
              device,
              inputTexture,
              nativeDimensions,
              targetDimensions,
            });
            const outTex = pipelineInstance.getOutputTexture();

            // Match canvas internal resolution to the upscaled output
            canvas.width = outTex.width;
            canvas.height = outTex.height;

            setupRenderPipeline(outTex);
          }

          // 1. Copy video frame to input texture
          device.queue.copyExternalImageToTexture({ source: video }, { texture: inputTexture }, [
            video.videoWidth,
            video.videoHeight,
            1,
          ]);

          // 2. Run Anime4K compute passes
          const encoder = device.createCommandEncoder();
          pipelineInstance.pass(encoder);

          // 3. Render final texture to canvas
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

          if (renderPipeline && bindGroup) {
            pass.setPipeline(renderPipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);
          }
          pass.end();

          device.queue.submit([encoder.finish()]);
          forceRender = false;
        };

        const checkFrame = () => {
          if (isDestroyed) return;

          const hasVFC = "requestVideoFrameCallback" in (video as any);
          const shouldFallbackRender = !hasVFC && !video.paused;

          if (
            (forceRender || shouldFallbackRender) &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            renderWebGPU();
          }

          rAFId = requestAnimationFrame(checkFrame);
        };

        const onVideoFrame = () => {
          if (isDestroyed) return;
          renderWebGPU();
          if ("requestVideoFrameCallback" in video) {
            vFCId = (video as any).requestVideoFrameCallback(onVideoFrame);
          }
        };

        // Start loops
        rAFId = requestAnimationFrame(checkFrame);
        if ("requestVideoFrameCallback" in video) {
          vFCId = (video as any).requestVideoFrameCallback(onVideoFrame);
        }
      } catch (err) {
        console.error("Anime4KWebGPU Error:", err);
      }
    })();

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(rAFId);
      if (vFCId && "cancelVideoFrameCallback" in video) {
        (video as any).cancelVideoFrameCallback(vFCId);
      }
    };
  }, [enabled, preset, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200 ${
        enabled ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
