import { useEffect, useMemo } from "react";
import { Rail, useCatalogStore } from "@/features/catalog";
import { usePlayerStore } from "@/features/player";
import type { HistoryItem } from "@/shared/types";
import { SectionHead } from "@/shared/ui/section-head";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { buildContinueWatchingItems } from "./continueWatchingItems";

/**
 * The home-screen "continue watching" rail: wide 16:9 cards, one resume action each. It appears
 * only when there is unfinished watch progress, so it never sits empty on a fresh install.
 */
export function ContinueWatching() {
  const { history, cachedReleases, latestReleases, fetchReleaseDetails } = useCatalogStore();
  const { playEpisode } = usePlayerStore();

  const releaseHistoryMap = useMemo(() => {
    const map = new Map<number, HistoryItem[]>();
    for (const item of history || []) {
      const list = map.get(item.release_id) || [];
      list.push(item);
      map.set(item.release_id, list);
    }
    return map;
  }, [history]);

  useEffect(() => {
    for (const releaseId of releaseHistoryMap.keys()) {
      if (!cachedReleases[releaseId] && !latestReleases.find((item) => item.id === releaseId)) {
        fetchReleaseDetails(releaseId);
      }
    }
  }, [releaseHistoryMap, cachedReleases, latestReleases, fetchReleaseDetails]);

  const carouselItems = useMemo(
    () => buildContinueWatchingItems(releaseHistoryMap, cachedReleases, latestReleases),
    [releaseHistoryMap, cachedReleases, latestReleases],
  );

  if (carouselItems.length === 0) {
    return null;
  }

  return (
    <section className="pb-2">
      <SectionHead title="Продолжить просмотр" trailing={carouselItems.length} />
      <Rail>
        {carouselItems.map((item) => (
          <ContinueWatchingCard
            key={`${item.releaseId}-${item.episodeOrdinal}`}
            item={item}
            onPlayEpisode={playEpisode}
          />
        ))}
      </Rail>
    </section>
  );
}
