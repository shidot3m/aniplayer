import { formatTime } from "../../lib/utils";
import type { EpisodeItem } from "../../types";
import { ControlsBar } from "./ControlsBar";
import { SeekBar } from "./SeekBar";

export interface PlayerBottomBarProps {
  isVisible: boolean;
  episode: EpisodeItem;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  hasPrev: boolean;
  hasNext: boolean;
  isFullscreen: boolean;
  currentQuality: "1080p" | "720p" | "480p";
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleFullscreen: () => void;
  onOpenDrawer: () => void;
  onGoToRelease: () => void;
  onSelectQuality: (q: "1080p" | "720p" | "480p") => void;
}

export function PlayerBottomBar({
  isVisible,
  episode,
  currentTime,
  duration,
  isPlaying,
  volume,
  hasPrev,
  hasNext,
  isFullscreen,
  currentQuality,
  onSeek,
  onTogglePlay,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleFullscreen,
  onOpenDrawer,
  onGoToRelease,
  onSelectQuality,
}: PlayerBottomBarProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-6 pt-12 transition-opacity duration-300 ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-200">
        <div
          data-testid="player-episode-badge-above-timeline"
          className="flex items-center gap-2 rounded-lg bg-black/40 px-2.5 py-1 text-xs text-rose-400 backdrop-blur"
        >
          <span>Серия {episode.ordinal}</span>
          {episode.name && (
            <span className="text-slate-400 font-normal truncate max-w-xs">— {episode.name}</span>
          )}
        </div>

        <div
          data-testid="player-timecodes-above-timeline"
          className="rounded-lg bg-black/40 px-2.5 py-1 text-xs text-slate-300 backdrop-blur"
        >
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-500 mx-1">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mb-3">
        <SeekBar currentTime={currentTime} duration={duration} onSeek={onSeek} />
      </div>

      <ControlsBar
        isPlaying={isPlaying}
        volume={volume}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isFullscreen={isFullscreen}
        currentQuality={currentQuality}
        onTogglePlay={onTogglePlay}
        onPrev={onPrev}
        onNext={onNext}
        onVolumeChange={onVolumeChange}
        onToggleFullscreen={onToggleFullscreen}
        onOpenDrawer={onOpenDrawer}
        onGoToRelease={onGoToRelease}
        onSelectQuality={onSelectQuality}
      />
    </div>
  );
}
