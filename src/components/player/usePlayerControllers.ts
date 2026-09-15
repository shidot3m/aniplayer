import { useCallback, useEffect, useRef } from "react";
import { useCatalogStore } from "../../store/catalogStore";
import type { EpisodeItem, Release, VideoQuality } from "../../types";
import { useHlsVideo } from "./useHlsVideo";
import { usePlayerHotkeys } from "./usePlayerHotkeys";

interface UsePlayerControllersOptions {
  release: Release;
  episode: EpisodeItem;
  currentTime: number;
  duration: number;
  activeQuality: VideoQuality;
  autoSkipOpEd: boolean;
  autoplayNext: boolean;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  speed: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (pos: number) => Promise<void>;
  seekRelative: (offset: number) => Promise<void>;
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
  autoSkipOpEd,
  autoplayNext,
  isPlaying,
  volume,
  isMuted,
  speed,
  play,
  pause,
  seekTo,
  seekRelative,
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

  const handlePrev = useCallback(() => {
    if (hasPrev) playEpisode(release, release.episodes[currentIndex - 1]);
  }, [hasPrev, playEpisode, release, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext) playEpisode(release, release.episodes[currentIndex + 1]);
  }, [hasNext, playEpisode, release, currentIndex]);

  const streamUrl =
    (activeQuality === "1080p" && episode.hls_1080) ||
    (activeQuality === "720p" && episode.hls_720) ||
    (activeQuality === "480p" && episode.hls_480) ||
    episode.hls_1080 ||
    episode.hls_720 ||
    episode.hls_480 ||
    "";

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
    return () => {
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration || 0);
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
      if (videoRef.current) {
        const dur = videoRef.current.duration || 999999;
        const newPos = Math.max(0, Math.min(dur, videoRef.current.currentTime + offset));
        videoSeek(newPos);
        seekTo(newPos);
      } else {
        seekRelative(offset);
      }
    },
    [videoRef, videoSeek, seekTo, seekRelative],
  );

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        video.play().catch(console.error);
        play();
      } else {
        video.pause();
        pause();
      }
    } else {
      togglePlay();
    }
  }, [videoRef, play, pause, togglePlay]);

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
        handleSeek(episode.opening.stop + 0.5);
      } else if (isInsideEnding && episode.ending?.stop != null) {
        handleSeek(episode.ending.stop + 0.5);
      }
    }
  }, [autoSkipOpEd, isInsideOpening, isInsideEnding, episode.opening, episode.ending, handleSeek]);

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
