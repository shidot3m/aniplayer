import type React from "react";
import { Anime4kCanvas } from "./Anime4kCanvas";

interface PlayerVideoViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamUrl: string;
  anime4kEnabled?: boolean;
  anime4kPreset?: string;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export function PlayerVideoViewport({
  videoRef,
  streamUrl,
  anime4kEnabled = false,
  anime4kPreset = "mode-a",
  onTogglePlay,
  onToggleFullscreen,
  onTimeUpdate,
  onLoadedMetadata,
  onPlay,
  onPause,
  onEnded,
}: PlayerVideoViewportProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Переключить воспроизведение"
      className="absolute inset-0 z-0 flex items-center justify-center bg-black cursor-pointer border-0 p-0 outline-none w-full h-full"
      onClick={onTogglePlay}
      onDoubleClick={onToggleFullscreen}
    >
      <video
        ref={videoRef}
        className={`h-full w-full object-contain pointer-events-none transition-opacity duration-200 ${
          anime4kEnabled ? "opacity-0" : "opacity-100"
        }`}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
      >
        <track kind="captions" />
      </video>

      <Anime4kCanvas videoRef={videoRef} enabled={anime4kEnabled} preset={anime4kPreset} />

      {!streamUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Загрузка видеопотока...
        </div>
      )}
    </button>
  );
}
