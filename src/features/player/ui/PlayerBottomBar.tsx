import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem } from "@/shared/types";
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
  availableQualities?: ("1080p" | "720p" | "480p")[];
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

const hidden =
  "pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-linear-to-t from-scrim/90 to-transparent px-9 pb-7 pt-12 opacity-0";
const shown =
  "pointer-events-auto absolute inset-x-0 bottom-0 z-30 bg-linear-to-t from-scrim/90 to-transparent px-9 pb-7 pt-12";

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
  availableQualities,
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
    <div className={isVisible ? shown : hidden}>
      <div data-testid="player-timecodes-above-timeline" className="mb-2 flex items-center gap-5">
        <span className="w-14 shrink-0 text-sm tabular-nums text-accent-ink">
          {formatTime(currentTime)}
        </span>
        <div className="min-w-0 flex-1">
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            opening={episode.opening}
            ending={episode.ending}
            onSeek={onSeek}
          />
        </div>
        <span className="w-14 shrink-0 text-right text-sm tabular-nums text-ink-2">
          {formatTime(duration)}
        </span>
      </div>

      <ControlsBar
        isPlaying={isPlaying}
        volume={volume}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isFullscreen={isFullscreen}
        currentQuality={currentQuality}
        availableQualities={availableQualities}
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
