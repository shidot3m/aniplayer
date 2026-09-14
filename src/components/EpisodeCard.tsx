import { CheckCircle2, Download, MoreVertical, Play } from "lucide-react";
import { useState } from "react";
import { CDN_BASE_URL } from "../lib/constants";
import { formatTime } from "../lib/utils";
import type { EpisodeItem } from "../types";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function formatPosterUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${CDN_BASE_URL}${cleanPath}`;
}

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
    ep.preview?.optimized?.thumbnail ||
    ep.preview?.optimized?.preview ||
    ep.preview?.optimized?.src ||
    ep.preview?.thumbnail ||
    ep.preview?.preview ||
    ep.preview?.src;

  const primaryThumb = formatPosterUrl(rawThumb);
  const finalThumb = imgError ? fallbackPoster : primaryThumb || fallbackPoster;

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl">
      {/* Clickable Card Action */}
      <button
        type="button"
        aria-label={`Воспроизвести эпизод ${ep.ordinal}`}
        onClick={onPlay}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
        <div className="pointer-events-none flex h-full w-full items-center justify-center bg-gradient-to-br from-black to-[#121318] p-4 text-center">
          <span className="text-xs text-slate-400">Эпизод {ep.ordinal}</span>
        </div>
      )}

      {/* Watched indicator icon when idle */}
      {isWatched && (
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-md bg-black/70 backdrop-blur-md p-1 text-emerald-400 border border-emerald-500/30 group-hover:opacity-0 transition-opacity">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Top Badges - Only visible on hover */}
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="backdrop-blur-xl bg-black/70 text-[10px] py-0.5 px-2 border-white/15 text-white font-medium"
          >
            Эпизод {ep.ordinal}
          </Badge>
          {isWatched && (
            <Badge
              variant="outline"
              className="backdrop-blur-xl bg-black/70 text-[10px] py-0.5 px-2 border-emerald-500/40 text-emerald-400 flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Просмотрен</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions Dropdown (Three dots) - Only visible on hover */}
      <div className="absolute right-2.5 top-2.5 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-xl bg-black/70 text-slate-300 hover:bg-white/20 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Действия с эпизодом"
            >
              <MoreVertical className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="right"
            className="w-52 backdrop-blur-2xl bg-black/90 border-white/15"
          >
            <DropdownMenuItem onClick={onToggleWatched}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              <span>{isWatched ? "Снять отметку" : "Отметить просмотренным"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
              <span>{isDownloading ? "Загрузка..." : "Скачать эпизод (HLS)"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center Play Icon on Hover */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600/90 text-white shadow-xl backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Hover Glass Darkening Overlay with Details */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <h4 className="text-xs font-bold text-white line-clamp-1 leading-tight">
          Эпизод {ep.ordinal}
        </h4>
        {ep.name && <p className="mt-0.5 text-[11px] text-slate-300 line-clamp-1">{ep.name}</p>}

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300 pt-1.5 border-t border-white/15">
          <span>{ep.duration ? formatTime(ep.duration) : ep.opening?.start ? "OP / ED" : "—"}</span>
          <span className="flex items-center gap-1.5 text-rose-400 group-hover:text-rose-300 font-medium">
            <Play className="h-3 w-3 fill-current" />
            Смотреть
          </span>
        </div>
      </div>
    </div>
  );
}
