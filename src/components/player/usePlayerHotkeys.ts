import { useEffect } from "react";

export interface UsePlayerHotkeysProps {
  onUserActivity: () => void;
  togglePlay: () => void;
  seekRelative: (offset: number) => void;
  seekTo: (pos: number) => void;
  setVolume: (vol: number) => void;
  volume: number;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  isInsideOpening: boolean;
  isInsideEnding: boolean;
  openingStop?: number | null;
  endingStop?: number | null;
  onNext: () => void;
  onPrev: () => void;
  setPreset: (preset: string) => void;
}

const PRESET_HOTKEYS: Record<string, string> = {
  Digit1: "Mode A+A (HQ)",
  Digit2: "Mode A (Fast)",
  Digit3: "Mode B+B (HQ)",
  Digit4: "Mode C+A (HQ)",
  Digit0: "Off",
};

function handlePlayerKey(e: KeyboardEvent, p: UsePlayerHotkeysProps) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  p.onUserActivity();

  if (e.shiftKey && PRESET_HOTKEYS[e.code]) {
    e.preventDefault();
    p.setPreset(PRESET_HOTKEYS[e.code]);
    return;
  }

  switch (e.code) {
    case "Space":
    case "KeyK":
      e.preventDefault();
      p.togglePlay();
      break;
    case "ArrowLeft":
      e.preventDefault();
      p.seekRelative(e.shiftKey ? -30 : -5);
      break;
    case "ArrowRight":
      e.preventDefault();
      p.seekRelative(e.shiftKey ? 30 : 5);
      break;
    case "ArrowUp":
      e.preventDefault();
      p.setVolume(Math.min(100, p.volume + 5));
      break;
    case "ArrowDown":
      e.preventDefault();
      p.setVolume(Math.max(0, p.volume - 5));
      break;
    case "KeyM":
      e.preventDefault();
      p.toggleMute();
      break;
    case "KeyF":
    case "F11":
      e.preventDefault();
      p.toggleFullscreen();
      break;
    case "KeyS":
      e.preventDefault();
      if (p.isInsideOpening && p.openingStop != null) {
        p.seekTo(p.openingStop + 0.5);
      } else if (p.isInsideEnding && p.endingStop != null) {
        p.seekTo(p.endingStop + 0.5);
      }
      break;
    case "KeyN":
      e.preventDefault();
      p.onNext();
      break;
    case "KeyP":
      e.preventDefault();
      p.onPrev();
      break;
  }
}

export function usePlayerHotkeys(p: UsePlayerHotkeysProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handlePlayerKey(e, p);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [p]);
}
