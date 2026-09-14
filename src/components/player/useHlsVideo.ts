import Hls from "hls.js";
import { useCallback, useEffect, useRef } from "react";

interface UseHlsVideoOptions {
  streamUrl: string;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  speed: number;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export function useHlsVideo({
  streamUrl,
  isPlaying,
  volume,
  isMuted,
  speed,
  initialTime = 0,
  onTimeUpdate,
  onLoadedMetadata,
  onPlay,
  onPause,
  onEnded,
}: UseHlsVideoOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const settingsRef = useRef({ volume, isMuted, speed, initialTime, isPlaying });

  useEffect(() => {
    settingsRef.current = { volume, isMuted, speed, initialTime, isPlaying };
  }, [volume, isMuted, speed, initialTime, isPlaying]);

  // Initialize and attach HLS stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const applyInitialSettings = () => {
      const s = settingsRef.current;
      video.volume = Math.max(0, Math.min(1, s.volume / 100));
      video.muted = s.isMuted || s.volume === 0;
      video.playbackRate = s.speed;
      if (s.initialTime > 0) {
        video.currentTime = s.initialTime;
      }
      if (s.isPlaying) {
        video.play().catch((err) => console.warn("Auto-play error:", err));
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyInitialSettings();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      applyInitialSettings();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && video.paused) {
      video.play().catch((err) => console.warn("Video play error:", err));
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying]);

  // Sync volume & mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume / 100));
    video.muted = isMuted || volume === 0;
  }, [volume, isMuted]);

  // Sync playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed]);

  const seek = useCallback((targetSeconds: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = targetSeconds;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && onTimeUpdate) {
      onTimeUpdate(video.currentTime, video.duration || 0);
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video && onLoadedMetadata) {
      onLoadedMetadata(video.duration || 0);
    }
  }, [onLoadedMetadata]);

  return {
    videoRef,
    seek,
    togglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay: onPlay,
    handlePause: onPause,
    handleEnded: onEnded,
  };
}
