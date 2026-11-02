interface PlayerVideoViewportProps {
  streamUrl: string;
  playbackError?: string | null;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
}

export function PlayerVideoViewport({
  streamUrl,
  playbackError,
  onTogglePlay,
  onToggleFullscreen,
}: PlayerVideoViewportProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Переключить воспроизведение"
      className="absolute inset-0 z-0 flex items-center justify-center bg-transparent cursor-pointer border-0 p-0 outline-hidden w-full h-full"
      onClick={onTogglePlay}
      onDoubleClick={onToggleFullscreen}
    >
      {playbackError ? (
        <div className="max-w-lg rounded-lg bg-black/85 px-6 py-4 text-center text-sm text-rose-300">
          <p className="mb-2 font-semibold">Не удалось воспроизвести эпизод</p>
          <p>{playbackError}</p>
        </div>
      ) : !streamUrl ? (
        <div className="rounded-lg bg-black/70 px-4 py-2 text-slate-300 text-sm">
          Загрузка видеопотока...
        </div>
      ) : null}
    </button>
  );
}
