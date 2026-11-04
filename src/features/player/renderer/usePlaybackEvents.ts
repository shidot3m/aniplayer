import { useEffect, useRef } from "react";
import { type PlaybackObserver, playback } from "./playbackSession";

interface UsePlaybackEventsOptions {
  onTimeUpdate: (position: number, duration: number) => void;
  onEnded: () => void;
  onFault: (message: string) => void;
}

/**
 * Routes what the media element reports into the overlay's playback logic. The element is the
 * backend, so the observer is the whole channel: no text protocol and no external process
 * events sit between them.
 */
export function usePlaybackEvents({
  onTimeUpdate,
  onEnded,
  onFault,
}: UsePlaybackEventsOptions): void {
  const callbacks = useRef({ onTimeUpdate, onEnded, onFault });

  useEffect(() => {
    callbacks.current = { onTimeUpdate, onEnded, onFault };
  }, [onTimeUpdate, onEnded, onFault]);

  useEffect(() => {
    const observer: PlaybackObserver = {
      onTime: (position, duration) => callbacks.current.onTimeUpdate(position, duration),
      onEnded: () => callbacks.current.onEnded(),
      onFault: (message) => callbacks.current.onFault(message),
    };
    playback.setObserver(observer);
    return () => playback.setObserver(null);
  }, []);
}
