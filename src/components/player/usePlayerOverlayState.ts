import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoHide(isPlaying: boolean, isDrawerOpen: boolean) {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isDrawerOpen && isPlaying) {
      hideTimerRef.current = setTimeout(() => setIsVisible(false), 2500);
    }
  }, [isDrawerOpen, isPlaying]);

  const handleUserActivity = useCallback(() => {
    setIsVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  useEffect(() => {
    scheduleAutoHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch (_e) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
