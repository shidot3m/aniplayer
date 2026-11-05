import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/shared/lib/constants";
import type { FranchiseItem, FranchiseReleaseItem } from "@/shared/types";

/** The catalog returns releases in storage order; `sort_order` is the chronological position a Franchise means. */
function withOrderedReleases(franchises: FranchiseItem[]): FranchiseItem[] {
  const position = (item: FranchiseReleaseItem) => item.sort_order ?? Number.MAX_SAFE_INTEGER;
  return franchises.map((franchise) =>
    franchise.franchise_releases
      ? {
          ...franchise,
          franchise_releases: [...franchise.franchise_releases].sort(
            (a, b) => position(a) - position(b),
          ),
        }
      : franchise,
  );
}

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
        if (isMounted) setFranchises(withOrderedReleases(data || []));
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
