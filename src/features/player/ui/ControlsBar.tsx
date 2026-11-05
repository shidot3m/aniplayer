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
import type { VideoQuality } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Slider } from "@/shared/ui/slider";
import { usePlayerStore } from "../state/playerStore";
import { SettingsMenu } from "./SettingsMenu";

interface ControlsBarProps {
  isPlaying: boolean;
  volume: number;
  hasPrev: boolean;
  hasNext: boolean;
  isFullscreen: boolean;
  currentQuality: VideoQuality;
  availableQualities?: VideoQuality[];
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleFullscreen: () => void;
  onOpenDrawer: () => void;
  onGoToRelease: () => void;
  onSelectQuality: (q: VideoQuality) => void;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

// A control sits transparent over the frame; only its tone changes on hover (ADR 0018 motion charter).
const control =
  "flex items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/10 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink disabled:pointer-events-none disabled:opacity-30";

// A floating picker over the video is glass — the one ornament allowed on the frame.
const glassTrigger =
  "glass flex h-9 cursor-pointer items-center rounded-[10px] px-3 text-[13px] font-medium tabular-nums text-ink shadow-float transition-colors hover:bg-glass focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink";
const glassContent = "bg-glass border-glass-line backdrop-blur-glass shadow-float";

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
  const { speed, setSpeed } = usePlayerStore();
  const [prevVolume, setPrevVolume] = useState(volume || 100);

  const qualities = availableQualities || (["1080p", "720p", "480p"] as VideoQuality[]);

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume > 0 ? prevVolume : 100);
    }
  };

  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="player-to-anime-btn"
          onClick={onGoToRelease}
          aria-label="К аниме"
          className={`h-9 ${control} gap-1.5 px-3 text-[13px]`}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">К аниме</span>
        </button>
        <button
          type="button"
          data-testid="player-episode-drawer-btn"
          onClick={onOpenDrawer}
          aria-label="Список эпизодов"
          className={`h-9 w-9 ${control}`}
        >
          <ListVideo className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="player-prev-btn"
          disabled={!hasPrev}
          onClick={onPrev}
          aria-label="Предыдущий эпизод"
          title="Предыдущий эпизод"
          className={`h-10 w-10 ${control}`}
        >
          <SkipBack className="h-5 w-5 fill-current" />
        </button>
        <button
          type="button"
          data-testid="player-play-pause-btn"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Пауза" : "Воспроизведение"}
          title={isPlaying ? "Пауза (Space)" : "Воспроизведение (Space)"}
          className={`h-11 w-11 ${control}`}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="h-6 w-6 fill-current ml-0.5" />
          )}
        </button>
        <button
          type="button"
          data-testid="player-next-btn"
          disabled={!hasNext}
          onClick={onNext}
          aria-label="Следующий эпизод"
          title="Следующий эпизод"
          className={`h-10 w-10 ${control}`}
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={volume === 0 ? "Включить звук" : "Без звука"}
          title={volume === 0 ? "Включить звук" : "Без звука"}
          className={`h-9 w-9 ${control}`}
        >
          {volume === 0 ? (
            <VolumeX className="h-5 w-5 text-accent-ink" />
          ) : (
            <Volume2 className="h-5 w-5" />
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

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger ariaLabel="Качество видео">
            <span className={glassTrigger}>{currentQuality}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className={`w-32 ${glassContent}`}>
            {qualities.map((q) => (
              <DropdownMenuItem
                key={q}
                onClick={() => onSelectQuality(q)}
                className={currentQuality === q ? "text-accent-ink" : ""}
              >
                <span className="tabular-nums">{q}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger ariaLabel="Скорость воспроизведения">
            <span className={glassTrigger}>
              ×{speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className={`w-32 ${glassContent}`}>
            {SPEEDS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => setSpeed(s)}
                className={speed === s ? "text-accent-ink" : ""}
              >
                <span className="tabular-nums">×{s}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <SettingsMenu />

        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
          title={isFullscreen ? "Выйти из полноэкранного режима (F)" : "Во весь экран (F)"}
          className={`h-10 w-10 ${control}`}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
