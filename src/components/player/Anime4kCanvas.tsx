import { useEffect, useRef } from "react";
import { Anime4kRenderer } from "./anime4kRenderer";

interface Anime4kCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  preset: string;
}

export function Anime4kCanvas({ videoRef, enabled, preset }: Anime4kCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const renderer = new Anime4kRenderer(video, canvas, preset);
    void renderer.start();
    return () => renderer.destroy();
  }, [enabled, preset, videoRef]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full object-contain pointer-events-none"
    />
  );
}
