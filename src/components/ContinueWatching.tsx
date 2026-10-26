import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCatalogStore } from "../store/catalogStore";
import { usePlayerStore } from "../store/playerStore";
import type { HistoryItem, Release } from "../types";
import { ContinueWatchingCard } from "./continue-watching/ContinueWatchingCard";
import { buildContinueWatchingItems } from "./continue-watching/continueWatchingItems";
import { Badge } from "./ui/badge";

interface ContinueWatchingProps {
  onSelectRelease: (release: Release) => void;
}

export function ContinueWatching({ onSelectRelease }: ContinueWatchingProps) {
  const { history, cachedReleases, latestReleases, fetchReleaseDetails } = useCatalogStore();
  const { playEpisode } = usePlayerStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const checkScrollBounds = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 5);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 5);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const element = scrollContainerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => checkScrollBounds());
    observer.observe(element);
    return () => observer.disconnect();
  }, [checkScrollBounds]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const distance = 340;
    element.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  if (carouselItems.length === 0) {
    return null;
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500">
            <Play className="h-3.5 w-3.5 fill-current" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">Продолжить просмотр</h2>
          <Badge variant="rose" className="h-5 px-1.5 text-[10px]">
            {carouselItems.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Прокрутить назад"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12131A] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Прокрутить вперед"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#12131A] border border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={checkScrollBounds}
        className="flex gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-3 pt-1 snap-x snap-mandatory"
      >
        {carouselItems.map((item) => (
          <ContinueWatchingCard
            key={`${item.releaseId}-${item.episodeOrdinal}`}
            item={item}
            onSelectRelease={onSelectRelease}
            onPlayEpisode={playEpisode}
          />
        ))}
      </div>
    </section>
  );
}
