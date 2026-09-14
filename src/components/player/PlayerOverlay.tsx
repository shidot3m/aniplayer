import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "../../lib/utils";
import { usePlayerStore } from "../../store/playerStore";
import type { EpisodeItem, Release } from "../../types";
import { ControlsBar } from "./ControlsBar";
import { EpisodeDrawer } from "./EpisodeDrawer";
import { SeekBar } from "./SeekBar";
import { SkipToast } from "./SkipToast";

interface PlayerTopBarProps {
  isVisible: boolean;
  release: Release;
  onBack: () => void;
}

function PlayerTopBar({ isVisible, release, onBack }: PlayerTopBarProps) {
  return (
    <div
      className={`absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-6 transition-opacity duration-300 ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="player-back-btn"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur hover:bg-white/20 transition-colors cursor-pointer"
          title="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-white leading-tight drop-shadow">
            {release.name.main}
          </h2>
          {(release.name.alternative || release.name.english) && (
            <p className="text-xs text-slate-300 drop-shadow">
              {release.name.alternative || release.name.english}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface PlayerBottomBarProps {
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

function PlayerBottomBar({
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
      {/* Above Timeline: Episode number on LEFT, Timecodes on RIGHT */}
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

      {/* Seekbar */}
      <div className="mb-3">
        <SeekBar currentTime={currentTime} duration={duration} onSeek={onSeek} />
      </div>

      {/* Controls */}
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

interface PlayerOverlayProps {
  release: Release;
  episode: EpisodeItem;
  onBack: () => void;
  onGoToRelease: () => void;
}

export function PlayerOverlay({ release, episode, onBack, onGoToRelease }: PlayerOverlayProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    togglePlay,
    seekTo,
    playEpisode,
    autoSkipOpEd,
    autoplayNext,
  } = usePlayerStore();

  const [isVisible, setIsVisible] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<"1080p" | "720p" | "480p">("1080p");
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isDrawerOpen && isPlaying) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 2500);
    }
  }, [isDrawerOpen, isPlaying]);

  const handleUserActivity = useCallback(() => {
    setIsVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  useEffect(() => {
    scheduleAutoHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleAutoHide]);

  useEffect(() => {
    window.addEventListener("pointermove", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    return () => {
      window.removeEventListener("pointermove", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, [handleUserActivity]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch (_e) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  }, []);

  const currentIndex = release.episodes.findIndex((e) => e.id === episode.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < release.episodes.length - 1;

  const handlePrev = () => {
    if (hasPrev) playEpisode(release, release.episodes[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) playEpisode(release, release.episodes[currentIndex + 1]);
  };

  const isInsideOpening =
    episode.opening?.start != null &&
    episode.opening?.stop != null &&
    currentTime >= episode.opening.start &&
    currentTime <= episode.opening.stop;

  const isInsideEnding =
    episode.ending?.start != null &&
    episode.ending?.stop != null &&
    currentTime >= episode.ending.start &&
    currentTime <= episode.ending.stop;

  useEffect(() => {
    if (autoSkipOpEd) {
      if (isInsideOpening && episode.opening?.stop != null) {
        seekTo(episode.opening.stop + 0.5);
      } else if (isInsideEnding && episode.ending?.stop != null) {
        seekTo(episode.ending.stop + 0.5);
      }
    }
  }, [autoSkipOpEd, isInsideOpening, isInsideEnding, episode.opening, episode.ending, seekTo]);

  const timeLeft = duration > 0 ? duration - currentTime : 999;
  const isAutoplayCountdown = autoplayNext && hasNext && timeLeft <= 15 && timeLeft > 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none font-sans">
      <PlayerTopBar isVisible={isVisible} release={release} onBack={onBack} />

      <div className="absolute bottom-28 right-8 z-40 flex flex-col gap-2 pointer-events-auto">
        {!autoSkipOpEd && isInsideOpening && episode.opening?.stop != null && (
          <SkipToast type="opening" onSkip={() => seekTo(episode.opening?.stop ?? currentTime)} />
        )}
        {!autoSkipOpEd && isInsideEnding && episode.ending?.stop != null && (
          <SkipToast type="ending" onSkip={() => seekTo(episode.ending?.stop ?? currentTime)} />
        )}
        {isAutoplayCountdown && (
          <SkipToast
            type="next_episode"
            countdownSeconds={Math.ceil(timeLeft)}
            onSkip={handleNext}
          />
        )}
      </div>

      <PlayerBottomBar
        isVisible={isVisible}
        episode={episode}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        volume={volume}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isFullscreen={isFullscreen}
        currentQuality={currentQuality}
        onSeek={seekTo}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onVolumeChange={setVolume}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onGoToRelease={onGoToRelease}
        onSelectQuality={setCurrentQuality}
      />

      <EpisodeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        release={release}
        currentEpisode={episode}
        watchedEpIds={new Set()}
        onSelectEpisode={(ep) => playEpisode(release, ep)}
      />
    </div>
  );
}
