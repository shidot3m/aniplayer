import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/constants";
import type { FranchiseItem } from "../types";

export function useFranchises(releaseId: number) {
  const [franchises, setFranchises] = useState<FranchiseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadFranchises() {
      setIsLoading(true);
      try {
        let data: FranchiseItem[] = [];
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          try {
            data = await invoke<FranchiseItem[]>("api_get_release_franchises", {
              releaseId,
            });
          } catch (_err) {
            const res = await fetch(`${API_BASE_URL}/anime/franchises/release/${releaseId}`);
            if (res.ok) data = await res.json();
          }
        } else {
          const res = await fetch(`${API_BASE_URL}/anime/franchises/release/${releaseId}`);
          if (res.ok) data = await res.json();
        }
        if (isMounted) setFranchises(data || []);
      } catch (e) {
        console.error("Failed to load franchises:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadFranchises();
    return () => {
      isMounted = false;
    };
  }, [releaseId]);

  return { franchises, isLoading };
}
