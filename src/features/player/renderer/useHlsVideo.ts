import Hls from "hls.js";
import { useCallback, useEffect, useRef } from "react";

/**
 * Origins the app's own local protocols answer on: the asset protocol for a
 * downloaded file, and the remux protocol for a Matroska episode rebuilt into an MP4
 * on the fly. Both are plain progressive files, so the element loads them itself —
 * hls.js would only understand a playlist.
 */
const LOCAL_PROTOCOL_ORIGINS = [
  "http://asset.localhost/",
  "asset://localhost/",
  "http://remux.localhost/",
  "remux://localhost/",
];

function isLocalProtocolUrl(streamUrl: string): boolean {
  return LOCAL_PROTOCOL_ORIGINS.some((origin) => streamUrl.startsWith(origin));
}

function isPlaylistUrl(streamUrl: string): boolean {
  return streamUrl.split(/[?#]/, 1)[0].toLowerCase().endsWith(".m3u8");
}

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

  // Attach the stream: playlists go through hls.js, plain files natively
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

    const isLocalFile = isLocalProtocolUrl(streamUrl);
    const isLocalPlaylist = isLocalFile && isPlaylistUrl(streamUrl);

    if (Hls.isSupported() && (!isLocalFile || isLocalPlaylist)) {
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
    } else if (isLocalFile || video.canPlayType("application/vnd.apple.mpegurl")) {
      // Downloaded torrent episodes and remuxed Matroska episodes are plain files
      // served by a local protocol; hls.js only understands playlists, so the
      // element loads them directly. Downloaded HLS episodes are playlists and keep
      // the hls.js path above, because WebView2 has no native TS demuxer.
      video.addEventListener("loadedmetadata", applyInitialSettings, { once: true });
      video.src = streamUrl;
    }

    return () => {
      video.removeEventListener("loadedmetadata", applyInitialSettings);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  // Attach native play, pause, ended listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlayEvent = () => {
      onPlay?.();
    };
    const handlePauseEvent = () => {
      onPause?.();
    };
    const handleEndedEvent = () => {
      onEnded?.();
    };

    video.addEventListener("play", handlePlayEvent);
    video.addEventListener("pause", handlePauseEvent);
    video.addEventListener("ended", handleEndedEvent);

    return () => {
      video.removeEventListener("play", handlePlayEvent);
      video.removeEventListener("pause", handlePauseEvent);
      video.removeEventListener("ended", handleEndedEvent);
    };
  }, [onPlay, onPause, onEnded]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && video.paused) {
      video.play()?.catch((err) => console.warn("Video play error:", err));
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
