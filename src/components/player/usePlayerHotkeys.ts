import { useEffect } from "react";
import type { PlayerHotkeysConfig } from "../../shared/types";
import { usePlayerStore } from "../../store/playerStore";

export interface UsePlayerHotkeysProps {
  onUserActivity: () => void;
  togglePlay: () => void;
  seekRelative: (offset: number) => void;
  seekTo: (pos: number) => void;
  setVolume: (vol: number) => void;
  volume: number;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  exitFullscreen?: () => void | Promise<void>;
  isFullscreen?: boolean;
  onBack?: () => void;
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

function handlePlayerKey(e: KeyboardEvent, p: UsePlayerHotkeysProps, hk: PlayerHotkeysConfig) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  p.onUserActivity();

  if (e.shiftKey && PRESET_HOTKEYS[e.code]) {
    e.preventDefault();
    p.setPreset(PRESET_HOTKEYS[e.code]);
    return;
  }

  const code = e.code;

  if (code === hk.togglePlay || (hk.togglePlay === "Space" && code === "KeyK")) {
    e.preventDefault();
    p.togglePlay();
  } else if (code === hk.seekBack) {
    e.preventDefault();
    p.seekRelative(e.shiftKey ? -30 : -5);
  } else if (code === hk.seekForward) {
    e.preventDefault();
    p.seekRelative(e.shiftKey ? 30 : 5);
  } else if (code === hk.volumeUp) {
    e.preventDefault();
    p.setVolume(Math.min(100, p.volume + 5));
  } else if (code === hk.volumeDown) {
    e.preventDefault();
    p.setVolume(Math.max(0, p.volume - 5));
  } else if (code === hk.toggleMute) {
    e.preventDefault();
    p.toggleMute();
  } else if (code === hk.toggleFullscreen || (hk.toggleFullscreen === "KeyF" && code === "F11")) {
    e.preventDefault();
    p.toggleFullscreen();
  } else if (code === "Escape") {
    e.preventDefault();
    if (p.isFullscreen) {
      p.exitFullscreen?.();
    } else if (p.onBack) {
      p.onBack();
    }
  } else if (code === hk.skipOpEd) {
    e.preventDefault();
    if (p.isInsideOpening && p.openingStop != null) {
      p.seekTo(p.openingStop + 0.5);
    } else if (p.isInsideEnding && p.endingStop != null) {
      p.seekTo(p.endingStop + 0.5);
    }
  } else if (code === hk.nextEpisode) {
    e.preventDefault();
    p.onNext();
  } else if (code === hk.prevEpisode) {
    e.preventDefault();
    p.onPrev();
  }
}

export function usePlayerHotkeys(p: UsePlayerHotkeysProps) {
  const hotkeys = usePlayerStore((s) => s.hotkeys);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handlePlayerKey(e, p, hotkeys);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [p, hotkeys]);
}
