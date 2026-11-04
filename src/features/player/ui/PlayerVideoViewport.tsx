// The measured AniLiberty HLS tiers carry no text track, so there is nothing to caption here.
// Both caption gates are scoped to the media element below and lifted by
// #64 if the player ever grows subtitles.
// aislop-ignore-file jsx-a11y/media-has-caption -- no caption source exists in the catalog today.
import { usePlaybackSurface } from "../renderer/usePlaybackSurface";

interface PlayerVideoViewportProps {
  playbackError?: string | null;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
}

/**
 * The frame itself. This is the playback backend: a media element that hls.js feeds through
 * Media Source Extensions, with the React controls laid over it in the same window.
 */
export function PlayerVideoViewport({
  playbackError,
  onTogglePlay,
  onToggleFullscreen,
}: PlayerVideoViewportProps) {
  const { videoRef, isBuffering } = usePlaybackSurface();

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
      {/* No native controls: the overlay draws them, and the element is never a tab stop. */}
      {/* biome-ignore lint/a11y/useMediaCaption: the catalog ships no text track to caption with. */}
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        playsInline
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label="Переключить воспроизведение"
        className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 outline-hidden"
        onClick={onTogglePlay}
        onDoubleClick={onToggleFullscreen}
      />

      {playbackError ? (
        <div className="absolute max-w-lg rounded-lg bg-black/85 px-6 py-4 text-center text-sm text-rose-300">
          <p className="mb-2 font-semibold">Не удалось воспроизвести эпизод</p>
          <p>{playbackError}</p>
        </div>
      ) : isBuffering ? (
        <div className="rounded-lg bg-black/70 px-4 py-2 text-slate-300 text-sm">
          Загрузка видеопотока...
        </div>
      ) : null}
    </div>
  );
}
