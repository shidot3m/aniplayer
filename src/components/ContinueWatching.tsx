import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CDN_BASE_URL } from "../lib/constants";
import { formatTime } from "../lib/utils";
import { useCatalogStore } from "../store/catalogStore";
import { usePlayerStore } from "../store/playerStore";
import type { EpisodeItem, HistoryItem, Release } from "../types";
import { Badge } from "./ui/badge";

interface ContinueWatchingProps {
  onSelectRelease: (release: Release) => void;
}

interface ContinueWatchingCardItem {
  releaseId: number;
  release: Release | null;
  targetEpisode: EpisodeItem | null;
  episodeOrdinal: number;
  isCompleted: boolean;
  isNextEpisode: boolean;
  lastPosition: number;
  duration: number;
  progressPercent: number;
  updatedAt: string;
}

function formatPosterUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${CDN_BASE_URL}${cleanPath}`;
}

export function ContinueWatching({ onSelectRelease }: ContinueWatchingProps) {
  const { history, cachedReleases, latestReleases, fetchReleaseDetails } = useCatalogStore();
  const { playEpisode } = usePlayerStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Group history by release_id
  const releaseHistoryMap = useMemo(() => {
    const map = new Map<number, HistoryItem[]>();
    for (const item of history || []) {
      const list = map.get(item.release_id) || [];
      list.push(item);
      map.set(item.release_id, list);
    }
    return map;
  }, [history]);

  // Ensure release metadata is loaded for all history entries
  useEffect(() => {
    for (const releaseId of releaseHistoryMap.keys()) {
      if (!cachedReleases[releaseId] && !latestReleases.find((r) => r.id === releaseId)) {
        fetchReleaseDetails(releaseId);
      }
    }
  }, [releaseHistoryMap, cachedReleases, latestReleases, fetchReleaseDetails]);

  // Compute carousel items
  const carouselItems = useMemo<ContinueWatchingCardItem[]>(() => {
    const result: ContinueWatchingCardItem[] = [];

    for (const [releaseId, items] of releaseHistoryMap.entries()) {
      const release =
        cachedReleases[releaseId] || latestReleases.find((r) => r.id === releaseId) || null;
      const sortedEps = [...(release?.episodes || [])].sort((a, b) => a.ordinal - b.ordinal);
      const completedEpIds = new Set(items.filter((h) => h.is_completed).map((h) => h.episode_id));

      // Check if there is an in-progress episode
      const inProgress = items.find((h) => !h.is_completed && h.last_position > 0);
      if (inProgress) {
        const ep =
          sortedEps.find(
            (e) => e.id === inProgress.episode_id || e.ordinal === inProgress.episode_ordinal,
          ) || null;
        const dur = inProgress.duration || (ep ? 1440 : 0);
        const pos = inProgress.last_position;
        const progress = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;

        result.push({
          releaseId,
          release,
          targetEpisode: ep,
          episodeOrdinal: inProgress.episode_ordinal,
          isCompleted: false,
          isNextEpisode: false,
          lastPosition: pos,
          duration: dur,
          progressPercent: progress,
          updatedAt: inProgress.updated_at || "",
        });
        continue;
      }

      // If last item completed, see if there's a next episode to watch
      const lastCompleted = items.find((h) => h.is_completed);
      if (lastCompleted) {
        const nextEp =
          sortedEps.find(
            (e) => e.ordinal > lastCompleted.episode_ordinal && !completedEpIds.has(e.id),
          ) || sortedEps.find((e) => !completedEpIds.has(e.id));

        if (nextEp) {
          result.push({
            releaseId,
            release,
            targetEpisode: nextEp,
            episodeOrdinal: nextEp.ordinal,
            isCompleted: false,
            isNextEpisode: true,
            lastPosition: 0,
            duration: 1440,
            progressPercent: 0,
            updatedAt: lastCompleted.updated_at || "",
          });
        }
      }
    }

    // Sort by latest activity date
    return result.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime() || 0;
      const dateB = new Date(b.updatedAt).getTime() || 0;
      return dateB - dateA;
    });
  }, [releaseHistoryMap, cachedReleases, latestReleases]);

  const checkScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => checkScrollBounds());
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkScrollBounds]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 340;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  if (carouselItems.length === 0) {
    return null;
  }

  return (
    <section className="mb-10">
      {/* Header with Title and Carousel Controls */}
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

      {/* Carousel Track */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScrollBounds}
        className="flex gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-3 pt-1 snap-x snap-mandatory"
      >
        {carouselItems.map((item) => {
          const { release, targetEpisode } = item;
          const title = release?.name?.main || `Аниме #${item.releaseId}`;
          const poster =
            release?.poster?.src ||
            release?.poster?.preview ||
            release?.poster?.optimized?.src ||
            release?.poster?.optimized?.preview ||
            release?.poster?.thumbnail ||
            "";
          const formattedPoster = formatPosterUrl(poster);

          return (
            <div
              key={`${item.releaseId}-${item.episodeOrdinal}`}
              className="group relative flex w-[310px] sm:w-[330px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#12131A] p-3 transition-all duration-300 hover:border-rose-500/40 hover:bg-[#161824] hover:shadow-xl hover:shadow-rose-950/20"
            >
              {/* Poster Thumbnail */}
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-black/50 border border-white/10">
                {formattedPoster ? (
                  <img
                    src={formattedPoster}
                    alt={title}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-[10px] text-slate-500">
                    N/A
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Воспроизвести эпизод"
                  onClick={() => {
                    if (release && targetEpisode) {
                      playEpisode(release, targetEpisode);
                    } else if (release) {
                      onSelectRelease(release);
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 transform transition-transform group-hover:scale-105">
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  </div>
                </button>
              </div>

              {/* Content & Progress */}
              <div className="ml-3.5 flex flex-1 flex-col justify-between overflow-hidden">
                <div>
                  <button
                    type="button"
                    onClick={() => release && onSelectRelease(release)}
                    className="text-left text-xs font-bold text-white truncate block w-full hover:text-rose-400 transition-colors cursor-pointer"
                    title={title}
                  >
                    {title}
                  </button>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold ${
                        item.isNextEpisode ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      Серия {item.episodeOrdinal}
                    </span>
                    {item.isNextEpisode ? (
                      <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Следующая
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{item.progressPercent}%</span>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <span>
                      {item.isNextEpisode ? "Готово к просмотру" : formatTime(item.lastPosition)}
                    </span>
                    {!item.isNextEpisode && item.duration > 0 && (
                      <span>{formatTime(item.duration)}</span>
                    )}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.isNextEpisode
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-rose-600 to-rose-400"
                      }`}
                      style={{
                        width: item.isNextEpisode ? "100%" : `${item.progressPercent}%`,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (release && targetEpisode) {
                        playEpisode(release, targetEpisode);
                      } else if (release) {
                        onSelectRelease(release);
                      }
                    }}
                    className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Play className="h-3 w-3 fill-rose-500 text-rose-500" />
                    <span>{item.isNextEpisode ? "Начать серию" : "Продолжить"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
