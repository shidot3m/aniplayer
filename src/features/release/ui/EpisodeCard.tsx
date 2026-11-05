import { CheckCircle2, Download, MoreVertical, Play } from "lucide-react";
import { useState } from "react";
import { formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
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
  isDownloading: boolean;
  onPlay: () => void;
  onToggleWatched: () => void;
  onDownload: () => void;
}

export function EpisodeCard({
  ep,
  fallbackPoster,
  isWatched,
  isDownloading,
  onPlay,
  onToggleWatched,
  onDownload,
}: EpisodeCardProps) {
  const [imgError, setImgError] = useState(false);
  const rawThumb =
    ep.preview?.optimized?.src ||
    ep.preview?.src ||
    ep.preview?.optimized?.preview ||
    ep.preview?.preview ||
    ep.preview?.optimized?.thumbnail ||
    ep.preview?.thumbnail;

  const primaryThumb = formatPosterUrl(rawThumb);
  const finalThumb = imgError ? fallbackPoster : primaryThumb || fallbackPoster;

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-line hover:border-ink/25 bg-ink/[0.02] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      {/* Clickable Card Action */}
      <button
        type="button"
        aria-label={`Воспроизвести эпизод ${ep.ordinal}`}
        onClick={onPlay}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
      />

      {/* Preview Image with Fallback */}
      {finalThumb ? (
        <img
          src={finalThumb}
          alt={`Эпизод ${ep.ordinal}`}
          loading="lazy"
          className="pointer-events-none h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => {
            if (!imgError && fallbackPoster && primaryThumb !== fallbackPoster) {
              setImgError(true);
            }
          }}
        />
      ) : (
        <div className="pointer-events-none flex h-full w-full items-center justify-center bg-linear-to-br/srgb from-scrim to-surface-1 p-4 text-center">
          <span className="text-xs text-ink-2">Эпизод {ep.ordinal}</span>
        </div>
      )}

      {/* Persistent Watched Visual Indicator (Always visible) */}
      {isWatched && (
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-md border border-line bg-scrim/80 px-2 py-0.5 text-[10px] font-semibold text-ink backdrop-blur-xl shadow-lg shadow-scrim/40">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Просмотрен</span>
        </div>
      )}

      {/* Watched Bottom Accent Bar */}
      {isWatched && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-accent z-20" />
      )}

      {/* Top Badges - Only visible on hover */}
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex items-center gap-1.5">
          {!isWatched && (
            <Badge
              variant="secondary"
              className="backdrop-blur-xl bg-scrim/70 text-[10px] py-0.5 px-2 border-ink/15 text-ink font-medium"
            >
              Эпизод {ep.ordinal}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions Dropdown (Three dots) - Only visible on hover */}
      <div className="absolute right-2.5 top-2.5 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink rounded-lg">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-xl bg-scrim/70 text-ink-2 hover:bg-ink/20 hover:text-ink border border-line transition-colors cursor-pointer"
              title="Действия с эпизодом"
            >
              <MoreVertical className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="right"
            className="w-56 backdrop-blur-2xl bg-scrim/90 border-ink/15"
          >
            <DropdownMenuItem onClick={onToggleWatched}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-ink-2" />
              <span>{isWatched ? "Снять отметку о просмотре" : "Отметить просмотренным"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5 text-ink-2" />
              <span>{isDownloading ? "Загрузка..." : "Скачать эпизод (HLS)"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hover Glass Darkening Overlay with Details */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-linear-to-t/srgb from-scrim/95 via-scrim/75 to-transparent p-3.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <h4 className="text-xs font-bold text-ink line-clamp-1 leading-tight">
          Эпизод {ep.ordinal}
        </h4>
        {ep.name && <p className="mt-0.5 text-[11px] text-ink-2 line-clamp-1">{ep.name}</p>}

        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-2 pt-1.5 border-t border-ink/15">
          <span>{ep.duration ? formatTime(ep.duration) : ep.opening?.start ? "OP / ED" : "—"}</span>
          <span className="flex items-center gap-1.5 text-accent-ink group-hover:text-ink font-medium">
            {isWatched ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> <span>Пересмотреть</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                <span>Смотреть</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Center Play Icon on Hover - in front of elements (z-20) */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-ink shadow-lg backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
        </div>
      </div>
    </div>
  );
}
