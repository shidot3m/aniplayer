import { Play } from "lucide-react";
import { formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem, Release } from "@/shared/types";
import type { ContinueWatchingCardItem } from "./continueWatchingItems";

interface ContinueWatchingCardProps {
  item: ContinueWatchingCardItem;
  onSelectRelease: (release: Release) => void;
  onPlayEpisode: (release: Release, episode: EpisodeItem, startPos: number) => void;
}

export function ContinueWatchingCard({
  item,
  onSelectRelease,
  onPlayEpisode,
}: ContinueWatchingCardProps) {
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

  const handlePlay = () => {
    if (release && targetEpisode) {
      onPlayEpisode(release, targetEpisode, item.lastPosition);
    } else if (release) {
      onSelectRelease(release);
    }
  };

  return (
    <div className="group relative flex w-[310px] sm:w-[330px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface-1 p-3 transition-all duration-300 hover:border-accent/40 hover:bg-surface-2 hover:shadow-xl hover:shadow-scrim/20">
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-scrim/50 border border-line">
        {formattedPoster ? (
          <img
            src={formattedPoster}
            alt={title}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-1 text-[10px] text-ink-3">
            N/A
          </div>
        )}
        <button
          type="button"
          aria-label="Воспроизвести эпизод"
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-scrim/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-ink"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-ink shadow-lg shadow-scrim/40 transform transition-transform group-hover:scale-105">
            <Play className="h-4 w-4 fill-ink ml-0.5" />
          </div>
        </button>
      </div>

      <div className="ml-3.5 flex flex-1 flex-col justify-between overflow-hidden">
        <div>
          <button
            type="button"
            onClick={() => release && onSelectRelease(release)}
            className="text-left text-xs font-bold text-ink truncate block w-full hover:text-accent-ink transition-colors cursor-pointer"
            title={title}
          >
            {title}
          </button>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-accent-ink">
              Серия {item.episodeOrdinal}
            </span>
            {item.isNextEpisode ? (
              <span className="text-[10px] text-ink-2">Следующая</span>
            ) : (
              <span className="text-[10px] text-ink-2">{item.progressPercent}%</span>
            )}
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-ink-2 mb-1.5">
            <span>{item.isNextEpisode ? "Готово к просмотру" : formatTime(item.lastPosition)}</span>
            {!item.isNextEpisode && item.duration > 0 && <span>{formatTime(item.duration)}</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{
                width: item.isNextEpisode ? "100%" : `${item.progressPercent}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handlePlay}
            className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-ink transition-colors cursor-pointer"
          >
            <Play className="h-3 w-3 fill-accent text-accent-ink" />
            <span>{item.isNextEpisode ? "Начать серию" : "Продолжить"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
