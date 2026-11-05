import { Check, Download, MoreVertical, Play } from "lucide-react";
import { useState } from "react";
import { formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export interface EpisodeCardProps {
  ep: EpisodeItem;
  fallbackPoster?: string;
  isWatched: boolean;
  isCurrent: boolean;
  isDownloading: boolean;
  onPlay: () => void;
  onToggleWatched: () => void;
  onDownload: () => void;
}

/**
 * A Release-page episode row (#70, ADR 0018): a wide 16:9 frame, the Ordinal in tabular figures,
 * the name, the duration as a timecode and a round play control. Rows are separated by a quiet
 * line, not boxed into cards; the current episode is lifted by tone and accent text, never a plate.
 */
export function EpisodeCard({
  ep,
  fallbackPoster,
  isWatched,
  isCurrent,
  isDownloading,
  onPlay,
  onToggleWatched,
  onDownload,
}: EpisodeCardProps) {
  const [imgError, setImgError] = useState(false);
  const primaryThumb = formatPosterUrl(
    ep.preview?.optimized?.src ||
      ep.preview?.src ||
      ep.preview?.optimized?.preview ||
      ep.preview?.preview ||
      ep.preview?.thumbnail,
  );
  const thumb = imgError ? fallbackPoster : primaryThumb || fallbackPoster;

  const title = ep.name || `Эпизод ${ep.ordinal}`;

  return (
    <div
      className={
        isCurrent
          ? "-mx-3.5 flex items-center gap-4.5 rounded-xl border-t border-transparent bg-accent/15 px-3.5 py-2.5"
          : "flex items-center gap-4.5 border-t border-line py-2.5"
      }
    >
      <span
        className={
          isCurrent
            ? "w-6 shrink-0 text-center text-sm tabular-nums text-accent-ink"
            : "w-6 shrink-0 text-center text-sm tabular-nums text-ink-3"
        }
      >
        {ep.ordinal}
      </span>

      <div className="relative shrink-0">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-[78px] w-[138px] rounded-[10px] bg-surface-1 object-cover"
            onError={() => {
              if (!imgError && fallbackPoster && primaryThumb !== fallbackPoster) setImgError(true);
            }}
          />
        ) : (
          <div className="flex h-[78px] w-[138px] items-center justify-center rounded-[10px] bg-surface-1 text-[11px] text-ink-2">
            {ep.ordinal}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span
          className={
            isCurrent
              ? "truncate text-[14.5px] font-semibold text-accent-ink"
              : "truncate text-[14.5px] font-semibold text-ink"
          }
        >
          {title}
        </span>
        {isWatched && <span className="mt-0.5 text-[13px] text-ink-3">Просмотрен</span>}
      </div>

      <span className="shrink-0 text-[13px] tabular-nums text-ink-2">
        {ep.duration ? formatTime(ep.duration) : "—"}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Воспроизвести эпизод ${ep.ordinal}`}
          className={
            isCurrent
              ? "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-accent/60 text-accent-ink transition-colors hover:bg-accent/15 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
              : "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-ink/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
          }
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger ariaLabel={`Действия с эпизодом ${ep.ordinal}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-ink">
              <MoreVertical className="h-4 w-4" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-56">
            <DropdownMenuItem onClick={onToggleWatched}>
              <Check className="mr-1.5 h-3.5 w-3.5 text-ink-2" />
              <span>{isWatched ? "Снять отметку о просмотре" : "Отметить просмотренным"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5 text-ink-2" />
              <span>{isDownloading ? "Загрузка…" : "Скачать эпизод (HLS)"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
