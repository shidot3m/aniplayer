import { Play } from "lucide-react";
import { formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem, Release } from "@/shared/types";
import type { ContinueWatchingCardItem } from "./continueWatchingItems";

interface ContinueWatchingCardProps {
  item: ContinueWatchingCardItem;
  onPlayEpisode: (release: Release, episode: EpisodeItem, startPos: number) => void;
}

export function ContinueWatchingCard({ item, onPlayEpisode }: ContinueWatchingCardProps) {
  const { release, targetEpisode } = item;
  const title = release?.name?.main || `Релиз #${item.releaseId}`;
  const posterUrl = formatPosterUrl(
    release?.poster?.src ||
      release?.poster?.preview ||
      release?.poster?.optimized?.src ||
      release?.poster?.thumbnail,
  );

  const canPlay = Boolean(release && targetEpisode);
  const remaining = Math.max(0, item.duration - item.lastPosition);

  const handlePlay = () => {
    if (release && targetEpisode) onPlayEpisode(release, targetEpisode, item.lastPosition);
  };

  return (
    <div className="group/card relative w-[316px] shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-surface-1 transition-[transform,box-shadow,border-color] hover:border-accent hover:shadow-lift focus-within:border-accent">
      <button
        type="button"
        onClick={handlePlay}
        disabled={!canPlay}
        aria-label={item.isNextEpisode ? "Начать серию" : "Продолжить"}
        className="block w-full cursor-pointer text-left disabled:cursor-default focus:outline-hidden"
      >
        <div className="relative">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt=""
              aria-hidden
              loading="eager"
              decoding="async"
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-surface-2 text-xs text-ink-2">
              {title}
            </div>
          )}
          <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-ground/75 text-ink opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </div>

        <div className="px-3.5 pt-2.5 pb-3">
          <div className="truncate text-sm font-semibold text-ink">{title}</div>
          <div className="mt-1 text-[13px] text-ink-2">
            Эпизод <span className="tabular-nums">{item.episodeOrdinal}</span> ·{" "}
            {item.isNextEpisode ? (
              <span className="tabular-nums">{formatTime(item.duration)}</span>
            ) : (
              <>
                осталось <span className="tabular-nums">{formatTime(remaining)}</span>
              </>
            )}
          </div>
          <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${item.isNextEpisode ? 0 : item.progressPercent}%` }}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
