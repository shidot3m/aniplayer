import { useEffect, useRef } from "react";
import type { Anime4kRenderer } from "../renderer/anime4kRenderer";

interface Anime4kCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  preset: string;
}

export function Anime4kCanvas({ videoRef, enabled, preset }: Anime4kCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // anime4k-webgpu (~3.4 MB) stays out of the player chunk until the
    // enhancement is actually switched on.
    let cancelled = false;
    let renderer: Anime4kRenderer | null = null;

    const start = async () => {
      try {
        const { Anime4kRenderer } = await import("../renderer/anime4kRenderer");
        if (cancelled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        renderer = new Anime4kRenderer(video, canvas, preset);
        void renderer.start();
      } catch (err) {
        console.error("Anime4K renderer chunk failed to load", err);
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (renderer) renderer.destroy();
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
