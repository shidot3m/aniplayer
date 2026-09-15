import React, { useEffect, useRef } from "react";

interface Anime4kCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  preset: string;
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform int u_mode;
varying vec2 v_texCoord;

float get_luma(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 d = 1.0 / u_resolution;
  vec2 uv = v_texCoord;

  // Sample 3x3 neighborhood
  vec4 c = texture2D(u_texture, uv);
  vec4 tl = texture2D(u_texture, uv + vec2(-d.x, -d.y));
  vec4 tc = texture2D(u_texture, uv + vec2(0.0, -d.y));
  vec4 tr = texture2D(u_texture, uv + vec2(d.x, -d.y));
  vec4 ml = texture2D(u_texture, uv + vec2(-d.x, 0.0));
  vec4 mr = texture2D(u_texture, uv + vec2(d.x, 0.0));
  vec4 bl = texture2D(u_texture, uv + vec2(-d.x, d.y));
  vec4 bc = texture2D(u_texture, uv + vec2(0.0, d.y));
  vec4 br = texture2D(u_texture, uv + vec2(d.x, d.y));

  float cL = get_luma(c.rgb);
  float tlL = get_luma(tl.rgb);
  float tcL = get_luma(tc.rgb);
  float trL = get_luma(tr.rgb);
  float mlL = get_luma(ml.rgb);
  float mrL = get_luma(mr.rgb);
  float blL = get_luma(bl.rgb);
  float bcL = get_luma(bc.rgb);
  float brL = get_luma(br.rgb);

  // Clamp Highlights neighborhood min and max
  vec3 minCol = min(c.rgb, min(min(tl.rgb, tr.rgb), min(bl.rgb, br.rgb)));
  minCol = min(minCol, min(min(tc.rgb, bc.rgb), min(ml.rgb, mr.rgb)));

  vec3 maxCol = max(c.rgb, max(max(tl.rgb, tr.rgb), max(bl.rgb, br.rgb)));
  maxCol = max(maxCol, max(max(tc.rgb, bc.rgb), max(ml.rgb, mr.rgb)));

  // Mode settings
  float sharpenStrength = 1.35;
  float thinStrength = 0.6;
  float deblurStrength = 1.1;
  bool doBilateral = false;

  if (u_mode == 0) {
    // Mode A (HQ) - Standard deblur + line thinning
    sharpenStrength = 1.35;
    thinStrength = 0.6;
    deblurStrength = 1.1;
  } else if (u_mode == 1) {
    // Mode A+A (HQ) - Dual pass maximum crispness
    sharpenStrength = 1.8;
    thinStrength = 0.85;
    deblurStrength = 1.4;
  } else if (u_mode == 2) {
    // Mode B (HQ) - Soft deblur for 720p/480p
    sharpenStrength = 0.95;
    thinStrength = 0.4;
    deblurStrength = 0.8;
    doBilateral = true;
  } else if (u_mode == 3) {
    // Mode B+B (HQ) - High deblur for SD
    sharpenStrength = 1.4;
    thinStrength = 0.7;
    deblurStrength = 1.3;
    doBilateral = true;
  } else if (u_mode == 4) {
    // Mode C (HQ) - Clean denoise + gentle edges
    sharpenStrength = 0.85;
    thinStrength = 0.3;
    deblurStrength = 0.7;
    doBilateral = true;
  } else if (u_mode == 5) {
    // Mode C+A (HQ) - Balanced denoise + line restoration
    sharpenStrength = 1.25;
    thinStrength = 0.55;
    deblurStrength = 1.0;
    doBilateral = true;
  } else {
    // Mode Fast (APU / iGPU) - Single pass
    sharpenStrength = 1.0;
    thinStrength = 0.0;
    deblurStrength = 0.8;
  }

  // Bilateral smoothing
  vec3 baseColor = c.rgb;
  if (doBilateral) {
    float weightSum = 1.0;
    vec3 accum = c.rgb;
    vec4 crossN[4];
    crossN[0] = tc; crossN[1] = ml; crossN[2] = mr; crossN[3] = bc;
    for (int i = 0; i < 4; i++) {
      float dist = distance(c.rgb, crossN[i].rgb);
      if (dist < 0.12) {
        float w = 1.0 - (dist / 0.12);
        accum += crossN[i].rgb * w;
        weightSum += w;
      }
    }
    baseColor = accum / weightSum;
  }

  // Sobel edge gradient
  float dX = (trL + 2.0 * mrL + brL) - (tlL + 2.0 * mlL + blL);
  float dY = (blL + 2.0 * bcL + brL) - (tlL + 2.0 * tcL + trL);
  vec2 grad = vec2(dX, dY);
  float edgeLen = length(grad);

  // Difference of Gaussians (DoG)
  float blurLuma = (tlL + trL + blL + brL) * 0.0625 + (tcL + mlL + mrL + bcL) * 0.125 + cL * 0.25;
  float dog = cL - blurLuma;

  // Line Thinning
  vec3 thinColor = baseColor;
  if (thinStrength > 0.01 && edgeLen > 0.03) {
    vec2 norm = grad / max(edgeLen, 0.001);
    vec4 sampleDarker = texture2D(u_texture, uv - norm * d * thinStrength);
    float darkerL = get_luma(sampleDarker.rgb);
    if (darkerL < cL) {
      thinColor = mix(baseColor, sampleDarker.rgb, 0.45);
    }
  }

  // Reconstruct with highlight clamp
  vec3 result = thinColor + (dog * sharpenStrength * deblurStrength);
  result = clamp(result, minCol, maxCol);

  gl_FragColor = vec4(result, 1.0);
}
`;

function getModeId(preset: string): number {
  const p = preset.toLowerCase();
  if (p.includes("a+a") || p === "mode-aa") return 1;
  if (p.includes("b+b") || p === "mode-bb") return 3;
  if (p.includes("c+a") || p === "mode-ca") return 5;
  if (p.includes("mode-b") || p === "mode-b") return 2;
  if (p.includes("mode-c") || p === "mode-c") return 4;
  if (p.includes("fast") || p.includes("apu") || p === "mode-fast") return 6;
  return 0; // Mode A by default
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function Anime4kCanvas({ videoRef, enabled, preset }: Anime4kCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        preserveDrawingBuffer: false,
      });
    } catch (_e) {
      return;
    }

    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Fullscreen Quad Buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Video Texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uMode = gl.getUniformLocation(program, "u_mode");
    const uTexture = gl.getUniformLocation(program, "u_texture");

    gl.uniform1i(uTexture, 0);
    gl.uniform1i(uMode, getModeId(preset));

    let isRunning = true;
    let frameId: number | null = null;
    let videoCallbackId: number | null = null;

    const render = () => {
      if (!isRunning || !canvas || !video || !gl) return;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Match canvas resolution to native video resolution or viewport
        const targetWidth = video.videoWidth;
        const targetHeight = video.videoHeight;

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          gl.viewport(0, 0, targetWidth, targetHeight);
        }

        gl.uniform2f(uResolution, targetWidth, targetHeight);
        gl.uniform1i(uMode, getModeId(preset));

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      if ("requestVideoFrameCallback" in video) {
        videoCallbackId = (video as any).requestVideoFrameCallback(render);
      } else {
        frameId = requestAnimationFrame(render);
      }
    };

    if ("requestVideoFrameCallback" in video) {
      videoCallbackId = (video as any).requestVideoFrameCallback(render);
    } else {
      frameId = requestAnimationFrame(render);
    }

    return () => {
      isRunning = false;
      if (videoCallbackId != null && "cancelVideoFrameCallback" in video) {
        (video as any).cancelVideoFrameCallback(videoCallbackId);
      }
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      if (gl) {
        if (texture) gl.deleteTexture(texture);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      }
    };
  }, [enabled, preset, videoRef]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full object-contain pointer-events-none"
    />
  );
}
