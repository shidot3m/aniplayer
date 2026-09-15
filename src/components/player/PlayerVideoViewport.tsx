import type React from "react";

interface PlayerVideoViewportProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamUrl: string;
  anime4kEnabled?: boolean;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
}

export function PlayerVideoViewport({
  videoRef,
  streamUrl,
  anime4kEnabled = false,
  onTogglePlay,
  onToggleFullscreen,
  onTimeUpdate,
  onLoadedMetadata,
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
        className={`h-full w-full object-contain pointer-events-none transition-all duration-200 ${
          anime4kEnabled ? "contrast-[1.03] saturate-[1.04]" : ""
        }`}
        style={{
          imageRendering: anime4kEnabled ? "crisp-edges" : "auto",
        }}
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
      >
        <track kind="captions" />
      </video>
      {!streamUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Загрузка видеопотока...
        </div>
      )}
    </button>
  );
}
