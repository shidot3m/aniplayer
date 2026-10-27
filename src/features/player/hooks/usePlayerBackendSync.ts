import { useEffect } from "react";
import { usePlayerStore } from "../state/playerStore";

export function usePlayerBackendSync() {
  const syncWithBackend = usePlayerStore((s) => s.syncWithBackend);

  useEffect(() => {
    const interval = setInterval(() => {
      syncWithBackend();
    }, 500);
    return () => clearInterval(interval);
  }, [syncWithBackend]);
}
