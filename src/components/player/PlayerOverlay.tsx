import { useCallback, useEffect, useMemo, useState } from "react";
import type { EpisodeItem, Release } from "../../shared/types";
import { useCatalogStore } from "../../store/catalogStore";
import { usePlayerStore } from "../../store/playerStore";
import { EpisodeDrawer } from "./EpisodeDrawer";
import { PlayerBottomBar } from "./PlayerBottomBar";
import { PlayerSkipToasts } from "./PlayerSkipToasts";
import { PlayerTopBar } from "./PlayerTopBar";
import { PlayerVideoViewport } from "./PlayerVideoViewport";
import { usePlayerControllers } from "./usePlayerControllers";
import { useAutoHide, useFullscreen } from "./usePlayerOverlayState";

interface PlayerOverlayProps {
  release: Release;
  episode: EpisodeItem;
  onBack: () => void;
  onGoToRelease: () => void;
}

export function PlayerOverlay({ release, episode, onBack, onGoToRelease }: PlayerOverlayProps) {
  const { history } = useCatalogStore();
  const playerStore = usePlayerStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isVisible, handleUserActivity } = useAutoHide(playerStore.isPlaying, isDrawerOpen);
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen();

  const handleBack = useCallback(async () => {
    await exitFullscreen();
    onBack();
  }, [exitFullscreen, onBack]);

  const handleGoToRelease = useCallback(async () => {
    await exitFullscreen();
    onGoToRelease();
  }, [exitFullscreen, onGoToRelease]);

  useEffect(() => {
    return () => {
      exitFullscreen();
    };
  }, [exitFullscreen]);

  const {
    videoRef,
    streamUrl,
    hasPrev,
    hasNext,
    handlePrev,
    handleNext,
    handleSeek,
    handleTogglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleEnded,
    availableQualities,
    timeLeft,
    isAutoplayCountdown,
    isInsideOpening,
    isInsideEnding,
  } = usePlayerControllers({
    release,
    episode,
    currentTime: playerStore.currentTime,
    duration: playerStore.duration,
    activeQuality: playerStore.activeQuality,
    setQuality: playerStore.setQuality,
    autoSkipOpEd: playerStore.autoSkipOpEd,
    autoplayNext: playerStore.autoplayNext,
    isPlaying: playerStore.isPlaying,
    volume: playerStore.volume,
    isMuted: playerStore.isMuted,
    speed: playerStore.speed,
    play: playerStore.play,
    pause: playerStore.pause,
    seekTo: playerStore.seekTo,
    togglePlay: playerStore.togglePlay,
    setVolume: playerStore.setVolume,
    toggleMute: playerStore.toggleMute,
    setAnime4kPreset: playerStore.setAnime4kPreset,
    playEpisode: playerStore.playEpisode,
    updateTime: playerStore.updateTime,
    handleUserActivity,
    toggleFullscreen,
    exitFullscreen,
    isFullscreen,
    onBack: handleBack,
  });

  const watchedEpIds = useMemo(
    () =>
      new Set(
        history
          .filter((h) => h.release_id === release.id && h.is_completed)
          .map((h) => h.episode_id),
      ),
    [history, release.id],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none font-sans">
      <PlayerVideoViewport
        videoRef={videoRef}
        streamUrl={streamUrl}
        anime4kEnabled={playerStore.anime4kEnabled}
        anime4kPreset={playerStore.anime4kPreset}
        onTogglePlay={handleTogglePlay}
        onToggleFullscreen={toggleFullscreen}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      />

      <PlayerTopBar
        isVisible={isVisible}
        release={release}
        anime4kEnabled={playerStore.anime4kEnabled}
        onBack={handleBack}
      />

      <PlayerSkipToasts
        autoSkipOpEd={playerStore.autoSkipOpEd}
        isInsideOpening={isInsideOpening}
        isInsideEnding={isInsideEnding}
        openingStop={episode.opening?.stop}
        endingStop={episode.ending?.stop}
        isAutoplayCountdown={isAutoplayCountdown}
        timeLeft={timeLeft}
        onSeek={handleSeek}
        onNext={handleNext}
      />

      <PlayerBottomBar
        isVisible={isVisible}
        episode={episode}
        currentTime={playerStore.currentTime}
        duration={playerStore.duration}
        isPlaying={playerStore.isPlaying}
        volume={playerStore.volume}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isFullscreen={isFullscreen}
        currentQuality={playerStore.activeQuality}
        availableQualities={availableQualities}
        onSeek={handleSeek}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onVolumeChange={playerStore.setVolume}
        onToggleFullscreen={toggleFullscreen}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onGoToRelease={handleGoToRelease}
        onSelectQuality={playerStore.setQuality}
      />

      <EpisodeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        release={release}
        currentEpisode={episode}
        watchedEpIds={watchedEpIds}
        onSelectEpisode={(ep) => playerStore.playEpisode(release, ep)}
      />
    </div>
  );
}
