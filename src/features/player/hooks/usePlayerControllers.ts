import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCatalogStore } from "@/features/catalog";
import type { EpisodeItem, Release, VideoQuality } from "@/shared/types";
import { usePlaybackEvents } from "../renderer/usePlaybackEvents";
import { usePlayerStore } from "../state/playerStore";
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
  seekTo: (pos: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  setAnime4kPreset: (preset: string) => Promise<void>;
  setAnime4kEnabled: (enabled: boolean) => Promise<void>;
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
  seekTo,
  togglePlay,
  setVolume,
  toggleMute,
  setAnime4kPreset,
  setAnime4kEnabled,
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

  const lastSavedTimeRef = useRef<number>(0);
  const playbackPositionRef = useRef({ currentTime, duration });
  useEffect(() => {
    playbackPositionRef.current = { currentTime, duration };
  }, [currentTime, duration]);
  const saveProgress = useCallback(
    (cur: number, dur: number) => {
      if (dur > 0 && cur >= 0) {
        useCatalogStore.getState().saveWatchProgress(release, episode, cur, dur);
        lastSavedTimeRef.current = cur;
      }
    },
    [release, episode],
  );

  const latestSave = useRef<() => void>(() => {});
  useEffect(() => {
    latestSave.current = () => {
      const position = playbackPositionRef.current;
      saveProgress(position.currentTime, position.duration);
    };
  }, [saveProgress]);

  const handleTimeUpdate = useCallback(
    (cur: number, dur: number) => {
      if (autoSkipOpEd) {
        if (
          episode.opening?.start != null &&
          episode.opening?.stop != null &&
          cur >= episode.opening.start &&
          cur < episode.opening.stop
        ) {
          const target = episode.opening.stop + 0.5;
          void seekTo(target);
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
          void seekTo(target);
          updateTime(target, dur);
          return;
        }
      }

      updateTime(cur, dur);
      if (Math.abs(cur - lastSavedTimeRef.current) >= 4) {
        saveProgress(cur, dur);
      }
    },
    [autoSkipOpEd, episode, saveProgress, seekTo, updateTime],
  );

  const handleEnded = useCallback(() => {
    const position = playbackPositionRef.current;
    saveProgress(position.duration || 1440, position.duration || 1440);
    if (hasNext) handleNext();
  }, [handleNext, hasNext, saveProgress]);

  const handleFault = useCallback((message: string) => {
    void usePlayerStore.getState().reportFault(message);
  }, []);

  usePlaybackEvents({
    onTimeUpdate: handleTimeUpdate,
    onEnded: handleEnded,
    onFault: handleFault,
  });

  useEffect(() => {
    // Unmounting is not closing. React remounts this overlay in development, and releasing
    // the session from here would take down the picture the next mount is already playing
    // into (issue #48). The store ends sessions — `closePlayer` on the way out, `reportFault`
    // when playback fails — and this effect only saves progress. Keying the save on
    // `saveProgress` would fire on every Episode switch, so it reaches the latest one
    // through a ref.
    return () => {
      latestSave.current();
    };
  }, []);

  const handleSeek = useCallback(
    (pos: number) => {
      void seekTo(pos);
    },
    [seekTo],
  );

  const handleSeekRelative = useCallback(
    (offset: number) => {
      const totalDuration = duration || 999999;
      const newPosition = Math.max(0, Math.min(totalDuration, currentTime + offset));
      void seekTo(newPosition);
    },
    [currentTime, duration, seekTo],
  );

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      const position = playbackPositionRef.current;
      saveProgress(position.currentTime, position.duration);
    }
    void togglePlay();
  }, [isPlaying, saveProgress, togglePlay]);

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
    setAnime4kPreset,
    setAnime4kEnabled,
  });

  const timeLeft = duration > 0 ? duration - currentTime : 999;
  const isAutoplayCountdown = autoplayNext && hasNext && timeLeft <= 15 && timeLeft > 0;

  return {
    availableQualities,
    hasPrev,
    hasNext,
    handlePrev,
    handleNext,
    handleSeek,
    handleTogglePlay,
    timeLeft,
    isAutoplayCountdown,
    isInsideOpening,
    isInsideEnding,
  };
}
