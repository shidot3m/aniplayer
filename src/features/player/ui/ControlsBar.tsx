import {
  ArrowLeft,
  ListVideo,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Slider } from "@/shared/ui/slider";
import { SettingsMenu } from "./SettingsMenu";

interface ControlsBarProps {
  isPlaying: boolean;
  volume: number;
  hasPrev: boolean;
  hasNext: boolean;
  isFullscreen: boolean;
  currentQuality: "1080p" | "720p" | "480p";
  availableQualities?: ("1080p" | "720p" | "480p")[];
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleFullscreen: () => void;
  onOpenDrawer: () => void;
  onGoToRelease: () => void;
  onSelectQuality: (q: "1080p" | "720p" | "480p") => void;
}

export function ControlsBar({
  isPlaying,
  volume,
  hasPrev,
  hasNext,
  isFullscreen,
  currentQuality,
  availableQualities,
  onTogglePlay,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleFullscreen,
  onOpenDrawer,
  onGoToRelease,
  onSelectQuality,
}: ControlsBarProps) {
  const [prevVolume, setPrevVolume] = useState(volume || 100);

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume > 0 ? prevVolume : 100);
    }
  };

  return (
    <div className="flex items-center justify-between pt-1">
      {/* Left controls: Go to anime, Episode list */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="player-to-anime-btn"
          onClick={onGoToRelease}
          className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>К аниме</span>
        </button>

        <button
          type="button"
          data-testid="player-episode-drawer-btn"
          onClick={onOpenDrawer}
          className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <ListVideo className="h-3.5 w-3.5" />
          <span>Список эпизодов</span>
        </button>
      </div>

      {/* Center controls: Prev, Play/Pause, Next */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="player-prev-btn"
          disabled={!hasPrev}
          onClick={onPrev}
          title="Предыдущий эпизод"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <SkipBack className="h-4 w-4 fill-current" />
        </button>

        <button
          type="button"
          data-testid="player-play-pause-btn"
          onClick={onTogglePlay}
          title={isPlaying ? "Пауза (Space)" : "Воспроизведение (Space)"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500 hover:scale-105 active:scale-95 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        <button
          type="button"
          data-testid="player-next-btn"
          disabled={!hasNext}
          onClick={onNext}
          title="Следующий эпизод"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <SkipForward className="h-4 w-4 fill-current" />
        </button>
      </div>

      {/* Right controls: Volume, Settings, Fullscreen */}
      <div className="flex items-center gap-3">
        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="text-slate-300 hover:text-white transition-colors cursor-pointer rounded-lg p-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
            title={volume === 0 ? "Включить звук" : "Без звука"}
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <div className="w-20">
            <Slider
              value={volume}
              min={0}
              max={100}
              step={1}
              ariaLabel="Громкость"
              onChange={onVolumeChange}
            />
          </div>
        </div>

        {/* Settings */}
        <SettingsMenu
          currentQuality={currentQuality}
          availableQualities={availableQualities}
          onSelectQuality={onSelectQuality}
        />

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Выйти из полноэкранного режима (F)" : "Во весь экран (F)"}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
