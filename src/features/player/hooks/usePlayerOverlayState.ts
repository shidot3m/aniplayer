import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "@/shared/lib/utils";
import { exitAnyFullscreen } from "../renderer/fullscreen";

export function useAutoHide(isPlaying: boolean, isDrawerOpen: boolean) {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const writeVisible = useCallback((value: boolean) => {
    if (isMountedRef.current) setIsVisible(value);
  }, []);

  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isDrawerOpen && isPlaying) {
      hideTimerRef.current = setTimeout(() => writeVisible(false), 2500);
    }
  }, [isDrawerOpen, isPlaying, writeVisible]);

  const handleUserActivity = useCallback(() => {
    writeVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide, writeVisible]);

  useEffect(() => {
    isMountedRef.current = true;
    scheduleAutoHide();
    return () => {
      isMountedRef.current = false;
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [scheduleAutoHide]);

  useEffect(() => {
    window.addEventListener("pointermove", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    return () => {
      window.removeEventListener("pointermove", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, [handleUserActivity]);

  return { isVisible, handleUserActivity };
}

function fullscreenStatus(): Promise<boolean> {
  if (isTauriRuntime()) {
    return invoke<boolean>("app_is_fullscreen").then(Boolean);
  }
  if (typeof document !== "undefined") {
    return Promise.resolve(Boolean(document.fullscreenElement));
  }
  return Promise.resolve(false);
}

async function setWindowFullscreen(next: boolean) {
  try {
    if (isTauriRuntime()) {
      await invoke("app_set_fullscreen", { fullscreen: next });
      return;
    }
  } catch {
    /* ignore */
  }

  try {
    if (next) {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMountedRef = useRef(true);
  const stateRef = useRef(false);

  const apply = useCallback((value: boolean) => {
    stateRef.current = value;
    if (isMountedRef.current) setIsFullscreen(value);
  }, []);

  const sync = useCallback(() => {
    fullscreenStatus()
      .then((v) => apply(v))
      .catch(() => {
        /* keep last known state */
      });
  }, [apply]);

  useEffect(() => {
    isMountedRef.current = true;
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [sync]);

  const exitFullscreenSideEffect = useCallback(async () => {
    await exitAnyFullscreen();
  }, []);

  const exitFullscreen = useCallback(async () => {
    apply(false);
    await exitAnyFullscreen();
  }, [apply]);

  const toggleFullscreen = useCallback(async () => {
    const next = !stateRef.current;
    apply(next);
    await setWindowFullscreen(next);
  }, [apply]);

  return { isFullscreen, toggleFullscreen, exitFullscreen, exitFullscreenSideEffect };
}
