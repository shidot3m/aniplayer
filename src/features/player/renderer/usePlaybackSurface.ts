import { useEffect, useRef, useState } from "react";
import { playback } from "./playbackSession";

/**
 * Hands the session to the `<video>` element the overlay draws and takes it back on unmount.
 * Unmounting is not closing: the session belongs to the store, so leaving the view only
 * releases the element it was drawing into (issue #48).
 *
 * It also reports whether the element is starved of media, which is the only moment the
 * overlay may promise a frame is arriving: a paused Episode is not loading, and saying it is
 * turns a deliberate pause into a fake spinner.
 */
export function usePlaybackSurface(): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isBuffering: boolean;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    playback.attach(video);

    const sync = () => setIsBuffering(video.readyState < video.HAVE_FUTURE_DATA);
    for (const event of ["loadeddata", "canplay", "playing", "waiting"] as const) {
      video.addEventListener(event, sync);
    }
    sync();

    return () => {
      for (const event of ["loadeddata", "canplay", "playing", "waiting"] as const) {
        video.removeEventListener(event, sync);
      }
      playback.detach(video);
    };
  }, []);

  return { videoRef, isBuffering };
}
