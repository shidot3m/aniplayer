import { useEffect, useRef } from "react";
import { playback } from "./playbackSession";

/**
 * Hands the session to the `<video>` element the overlay draws and takes it back on unmount.
 * Unmounting is not closing: the session belongs to the store, so leaving the view only
 * releases the element it was drawing into (issue #48).
 */
export function usePlaybackSurface(): React.RefObject<HTMLVideoElement | null> {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    playback.attach(video);
    return () => playback.detach(video);
  }, []);

  return videoRef;
}
