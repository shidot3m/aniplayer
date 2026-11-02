import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

interface NativePlayerEvent {
  type: "time" | "ended" | "fault" | "hardwareDecoder";
  position?: number;
  duration?: number;
  message?: string;
  decoder?: string | null;
}

interface UseNativePlayerOptions {
  onTimeUpdate: (position: number, duration: number) => void;
  onEnded: () => void;
  onFault: (message: string) => void;
  onHardwareDecoder?: (decoder: string | null) => void;
}

export function useNativePlayer({
  onTimeUpdate,
  onEnded,
  onFault,
  onHardwareDecoder,
}: UseNativePlayerOptions) {
  const callbacks = useRef({ onTimeUpdate, onEnded, onFault, onHardwareDecoder });

  useEffect(() => {
    callbacks.current = { onTimeUpdate, onEnded, onFault, onHardwareDecoder };
  }, [onTimeUpdate, onEnded, onFault, onHardwareDecoder]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const subscribe = async () => {
      const dispose = await listen<NativePlayerEvent>("player-event", ({ payload }) => {
        switch (payload.type) {
          case "time":
            callbacks.current.onTimeUpdate(payload.position ?? 0, payload.duration ?? 0);
            break;
          case "ended":
            callbacks.current.onEnded();
            break;
          case "fault":
            callbacks.current.onFault(payload.message || "Неизвестная ошибка mpv");
            break;
          case "hardwareDecoder":
            callbacks.current.onHardwareDecoder?.(payload.decoder ?? null);
            break;
        }
      });
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    };
    void subscribe();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
