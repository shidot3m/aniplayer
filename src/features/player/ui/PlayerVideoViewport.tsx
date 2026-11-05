// No caption track is rendered, because no catalog tier carries a text track to caption with:
// the measured refusal and its revisit trigger are in docs/adr/0017.
import { useCallback, useState } from "react";
import { usePlaybackSurface } from "../renderer/usePlaybackSurface";
import { Anime4kCanvas } from "./Anime4kCanvas";

interface PlayerVideoViewportProps {
  playbackError?: string | null;
  enhancementActive: boolean;
  anime4kPreset: string;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
}

/**
 * The frame itself. This is the playback backend: a media element that hls.js feeds through
 * Media Source Extensions, with the React controls laid over it in the same window.
 */
export function PlayerVideoViewport({
  playbackError,
  enhancementActive,
  anime4kPreset,
  onTogglePlay,
  onToggleFullscreen,
}: PlayerVideoViewportProps) {
  const { videoRef, isBuffering } = usePlaybackSurface();
  const [painted, setPainted] = useState(false);

  // The element stays visible until the canvas has a filtered frame on it, and the canvas
  // takes that promise back when its renderer stops, so switching the enhancement on cannot
  // show an empty canvas for a moment.
  const handlePainted = useCallback((framePainted: boolean) => setPainted(framePainted), []);

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-scrim">
      {/* No native controls: the overlay draws them, and the element is never a tab stop. */}
      {/* Once the renderer paints, the element underneath keeps decoding and driving audio. */}
      <video
        ref={videoRef}
        className={`h-full w-full bg-scrim object-contain ${
          enhancementActive && painted ? "opacity-0" : ""
        }`}
        playsInline
        tabIndex={-1}
        aria-hidden="true"
      />

      {enhancementActive && (
        <Anime4kCanvas videoRef={videoRef} preset={anime4kPreset} onPainted={handlePainted} />
      )}

      <button
        type="button"
        tabIndex={-1}
        aria-label="Переключить воспроизведение"
        className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 outline-hidden"
        onClick={onTogglePlay}
        onDoubleClick={onToggleFullscreen}
      />

      {playbackError ? (
        <div className="absolute max-w-lg rounded-lg bg-scrim/85 px-6 py-4 text-center text-sm text-accent-ink">
          <p className="mb-2 font-semibold">Не удалось воспроизвести эпизод</p>
          <p>{playbackError}</p>
        </div>
      ) : isBuffering ? (
        <div className="rounded-lg bg-scrim/70 px-4 py-2 text-ink-2 text-sm">
          Загрузка видеопотока...
        </div>
      ) : null}
    </div>
  );
}
