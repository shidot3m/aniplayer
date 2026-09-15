import { invoke } from "@tauri-apps/api/core";
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

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          const full = await invoke<boolean>("app_is_fullscreen");
          if (isMounted) setIsFullscreen(full);
        } else if (typeof document !== "undefined") {
          if (isMounted) setIsFullscreen(Boolean(document.fullscreenElement));
        }
      } catch {
        if (typeof document !== "undefined" && isMounted) {
          setIsFullscreen(Boolean(document.fullscreenElement));
        }
      }
    };

    checkStatus();

    const handleDocChange = () => {
      if (isMounted) setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleDocChange);

    return () => {
      isMounted = false;
      document.removeEventListener("fullscreenchange", handleDocChange);
    };
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("app_set_fullscreen", { fullscreen: false });
      }
    } catch {}

    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {}

    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        const current = await invoke<boolean>("app_is_fullscreen");
        await invoke("app_set_fullscreen", { fullscreen: !current });
        setIsFullscreen(!current);
        return;
      }
    } catch {}

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  return { isFullscreen, toggleFullscreen, exitFullscreen };
}
