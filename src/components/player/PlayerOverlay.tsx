import { useCallback, useEffect, useState } from "react";
import { useCatalogStore } from "../../store/catalogStore";
import { usePlayerStore } from "../../store/playerStore";
import type { EpisodeItem, Release } from "../../types";
import { EpisodeDrawer } from "./EpisodeDrawer";
import { PlayerBottomBar } from "./PlayerBottomBar";
import { PlayerTopBar } from "./PlayerTopBar";
import { SkipToast } from "./SkipToast";
import { usePlayerHotkeys } from "./usePlayerHotkeys";
import { useAutoHide, useFullscreen } from "./usePlayerOverlayState";

interface PlayerOverlayProps {
  release: Release;
  episode: EpisodeItem;
  onBack: () => void;
  onGoToRelease: () => void;
}

export function PlayerOverlay({ release, episode, onBack, onGoToRelease }: PlayerOverlayProps) {
  const { history } = useCatalogStore();
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    togglePlay,
    seekTo,
    seekRelative,
    toggleMute,
    setAnime4kPreset,
    playEpisode,
    autoSkipOpEd,
    autoplayNext,
  } = usePlayerStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<"1080p" | "720p" | "480p">("1080p");
  const { isVisible, handleUserActivity } = useAutoHide(isPlaying, isDrawerOpen);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const currentIndex = release.episodes.findIndex((e) => e.id === episode.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < release.episodes.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) playEpisode(release, release.episodes[currentIndex - 1]);
  }, [hasPrev, playEpisode, release, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext) playEpisode(release, release.episodes[currentIndex + 1]);
  }, [hasNext, playEpisode, release, currentIndex]);

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

  usePlayerHotkeys({
    onUserActivity: handleUserActivity,
    togglePlay,
    seekRelative,
    seekTo,
    setVolume,
    volume,
    toggleMute,
    toggleFullscreen,
    isInsideOpening,
    isInsideEnding,
    openingStop: episode.opening?.stop,
    endingStop: episode.ending?.stop,
    onNext: handleNext,
    onPrev: handlePrev,
    setPreset: setAnime4kPreset,
  });

  const timeLeft = duration > 0 ? duration - currentTime : 999;
  const isAutoplayCountdown = autoplayNext && hasNext && timeLeft <= 15 && timeLeft > 0;

  const watchedEpIds = new Set(
    history.filter((h) => h.release_id === release.id && h.is_completed).map((h) => h.episode_id),
  );

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
        onToggleFullscreen={toggleFullscreen}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onGoToRelease={onGoToRelease}
        onSelectQuality={setCurrentQuality}
      />

      <EpisodeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        release={release}
        currentEpisode={episode}
        watchedEpIds={watchedEpIds}
        onSelectEpisode={(ep) => playEpisode(release, ep)}
      />
    </div>
  );
}
