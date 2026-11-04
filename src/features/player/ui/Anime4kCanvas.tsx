import { useEffect, useRef } from "react";
import type { Anime4kRenderer } from "../renderer/anime4kRenderer";
import { usePlayerStore } from "../state/playerStore";

interface Anime4kCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  preset: string;
}

/**
 * The frame the renderer painted, laid over the media element it came from.
 *
 * The renderer arrives by dynamic import: `anime4k-webgpu` is ~3.4 MB of shader tables that a
 * user who never switched the enhancement on should not download ([ADR 0002]).
 */
export function Anime4kCanvas({ videoRef, preset }: Anime4kCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setFault = usePlayerStore((state) => state.setEnhancementFault);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;
    let renderer: Anime4kRenderer | null = null;

    const start = async () => {
      try {
        const module = await import("../renderer/anime4kRenderer");
        if (cancelled) return;
        renderer = new module.Anime4kRenderer(video, canvas, preset);
        await renderer.start();
        if (!cancelled) setFault(null);
      } catch (error) {
        // The surface falls back to the element: an empty canvas must not cover a live frame.
        if (!cancelled) setFault(error instanceof Error ? error.message : String(error));
      }
    };
    void start();

    return () => {
      cancelled = true;
      renderer?.stop();
    };
  }, [videoRef, preset, setFault]);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
    />
  );
}
