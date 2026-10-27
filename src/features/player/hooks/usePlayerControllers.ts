import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCatalogStore } from "@/features/catalog";
import type { EpisodeItem, Release, VideoQuality } from "@/shared/types";
import { useHlsVideo } from "../renderer/useHlsVideo";
import { getAvailableQualities } from "../state/playerStoreDefaults";
import { usePlayerHotkeys } from "./usePlayerHotkeys";

interface UsePlayerControllersOptions {
  release: Release;
  episode: EpisodeItem;
  currentTime: number;
  duration: number;
  activeQuality: VideoQuality;
  setQuality: (q: VideoQuality) => Promise<void>;
  autoSkipOpEd: boolean;
  autoplayNext: boolean;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  speed: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (pos: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  setAnime4kPreset: (preset: string) => Promise<void>;
  playEpisode: (release: Release, ep: EpisodeItem) => Promise<void>;
  updateTime: (cur: number, dur: number) => void;
  handleUserActivity: () => void;
  toggleFullscreen: () => void;
  exitFullscreen?: () => void | Promise<void>;
  isFullscreen?: boolean;
  onBack?: () => void;
}

export function usePlayerControllers({
  release,
  episode,
  currentTime,
  duration,
  activeQuality,
  setQuality,
  autoSkipOpEd,
  autoplayNext,
  isPlaying,
  volume,
  isMuted,
  speed,
  play,
  pause,
  seekTo,
  togglePlay,
  setVolume,
  toggleMute,
  setAnime4kPreset,
  playEpisode,
  updateTime,
  handleUserActivity,
  toggleFullscreen,
  exitFullscreen,
  isFullscreen,
  onBack,
}: UsePlayerControllersOptions) {
  const currentIndex = release.episodes.findIndex((e) => e.id === episode.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < release.episodes.length - 1;

  const availableQualities = useMemo(() => getAvailableQualities(episode), [episode]);

  // Ensure activeQuality matches an available stream on the episode
  useEffect(() => {
    if (!availableQualities.includes(activeQuality)) {
      const best = availableQualities[0];
      if (best) {
        setQuality(best);
      }
    }
  }, [availableQualities, activeQuality, setQuality]);

  const handlePrev = useCallback(() => {
    if (hasPrev) playEpisode(release, release.episodes[currentIndex - 1]);
  }, [hasPrev, playEpisode, release, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext) playEpisode(release, release.episodes[currentIndex + 1]);
  }, [hasNext, playEpisode, release, currentIndex]);

  const streamUrl = useMemo(() => {
    if (activeQuality === "1080p" && episode.hls_1080) return episode.hls_1080;
    if (activeQuality === "720p" && episode.hls_720) return episode.hls_720;
    if (activeQuality === "480p" && episode.hls_480) return episode.hls_480;
    return episode.hls_1080 || episode.hls_720 || episode.hls_480 || "";
  }, [activeQuality, episode]);

  const lastSavedTimeRef = useRef<number>(0);
  const saveProgress = useCallback(
    (cur: number, dur: number) => {
      if (dur > 0 && cur >= 0) {
        useCatalogStore.getState().saveWatchProgress(release, episode, cur, dur);
        lastSavedTimeRef.current = cur;
      }
    },
    [release, episode],
  );

  const {
    videoRef,
    seek: videoSeek,
    togglePlay: toggleVideoPlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleEnded,
  } = useHlsVideo({
    streamUrl,
    isPlaying,
    volume,
    isMuted,
    speed,
    initialTime: currentTime,
    onTimeUpdate: (cur, dur) => {
      // Auto-skip opening or ending if enabled
      if (autoSkipOpEd) {
        if (
          episode.opening?.start != null &&
          episode.opening?.stop != null &&
          cur >= episode.opening.start &&
          cur < episode.opening.stop
        ) {
          const target = episode.opening.stop + 0.5;
          videoSeek(target);
          updateTime(target, dur);
          return;
        }
        if (
          episode.ending?.start != null &&
          episode.ending?.stop != null &&
          cur >= episode.ending.start &&
          cur < episode.ending.stop
        ) {
          const target = episode.ending.stop + 0.5;
          videoSeek(target);
          updateTime(target, dur);
          return;
        }
      }

      updateTime(cur, dur);
      if (Math.abs(cur - lastSavedTimeRef.current) >= 4) {
        saveProgress(cur, dur);
      }
    },
    onLoadedMetadata: (dur) => updateTime(currentTime, dur),
    onPlay: play,
    onPause: () => {
      pause();
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration || 0);
      }
    },
    onEnded: () => {
      if (videoRef.current) {
        saveProgress(videoRef.current.duration || 1440, videoRef.current.duration || 1440);
      }
      if (hasNext) handleNext();
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        saveProgress(video.currentTime, video.duration || 0);
      }
    };
  }, [saveProgress, videoRef]);

  const handleSeek = useCallback(
    (pos: number) => {
      videoSeek(pos);
      seekTo(pos);
    },
    [videoSeek, seekTo],
  );

  const handleSeekRelative = useCallback(
    (offset: number) => {
      const totalDuration = duration || 999999;
      const newPosition = Math.max(0, Math.min(totalDuration, currentTime + offset));
      videoSeek(newPosition);
      seekTo(newPosition);
    },
    [currentTime, duration, videoSeek, seekTo],
  );

  const handleTogglePlay = useCallback(() => {
    toggleVideoPlay();
    togglePlay();
  }, [toggleVideoPlay, togglePlay]);

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

  usePlayerHotkeys({
    onUserActivity: handleUserActivity,
    togglePlay: handleTogglePlay,
    seekRelative: handleSeekRelative,
    seekTo: handleSeek,
    setVolume,
    volume,
    toggleMute,
    toggleFullscreen,
    exitFullscreen,
    isFullscreen,
    onBack,
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

  return {
    videoRef,
    streamUrl,
    availableQualities,
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
    timeLeft,
    isAutoplayCountdown,
    isInsideOpening,
    isInsideEnding,
  };
}
