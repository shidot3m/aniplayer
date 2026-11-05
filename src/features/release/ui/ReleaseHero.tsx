import { Bookmark, CheckCircle2, ChevronDown, Clock, Film, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_NAMES, formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatDurationMinutes, formatTotalWatchTime } from "@/shared/lib/utils";
import type { BookmarkCategory, EpisodeItem, Release } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface ReleaseHeroProps {
  release: Release;
  isWatched: boolean;
  currentCategory: BookmarkCategory | null;
  startEpisode: EpisodeItem | null;
  playButtonText: string;
  onPlay: (ep: EpisodeItem) => void;
  onBookmarkChange: (cat: BookmarkCategory) => void;
  onRemoveBookmark: () => void;
}

export function ReleaseHero({
  release,
  isWatched,
  currentCategory,
  startEpisode,
  playButtonText,
  onPlay,
  onBookmarkChange,
  onRemoveBookmark,
}: ReleaseHeroProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const descText = release.description;
  useEffect(() => {
    const el = descRef.current;
    if (!el || !descText) return;

    const checkOverflow = () => {
      if (!el) return;
      if (el.scrollHeight > el.clientHeight + 1) {
        setCanExpand(true);
      }
    };

    checkOverflow();
    const timer = setTimeout(checkOverflow, 80);
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [descText]);

  const formattedPoster = formatPosterUrl(
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail,
  );
  const totalEpisodesCount = release.episodes_total || release.episodes?.length || 0;
  const avgDuration = release.average_duration_of_episode || 24;
  const watchTimeStr = formatTotalWatchTime(totalEpisodesCount, avgDuration);

  return (
    <div className="mb-10 flex flex-col gap-8 md:flex-row">
      <div className="relative aspect-[2/3] w-full max-w-[280px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#12131A] shadow-2xl mx-auto md:mx-0">
        {formattedPoster ? (
          <img
            src={formattedPoster}
            alt={release.name.main}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            Нет постера
          </div>
        )}
        {isWatched && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-xl shadow-lg shadow-black/50">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Просмотрено</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {release.name.main}
          </h1>
          {release.name.alternative && (
            <p className="mt-1 text-sm text-slate-400 font-medium">{release.name.alternative}</p>
          )}
          {release.name.english && <p className="text-xs text-slate-400">{release.name.english}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isWatched && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-950/40 text-emerald-400 flex items-center gap-1 font-semibold"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Просмотрено</span>
              </Badge>
            )}
            {release.type?.description && <Badge variant="rose">{release.type.description}</Badge>}
            {release.year && <Badge variant="secondary">{release.year}</Badge>}
            <Badge variant="outline" className="border-white/10 text-slate-300">
              <Clock className="mr-1 h-3 w-3 text-slate-400" />
              {formatDurationMinutes(release.average_duration_of_episode)}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              <Film className="mr-1 h-3 w-3 text-slate-400" />
              {totalEpisodesCount > 0 ? `${totalEpisodesCount} эп.` : "Онгоинг"}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              Время: {watchTimeStr}
            </Badge>
          </div>

          {release.genres && release.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {release.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300 border border-white/5"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {release.description && (
            <div className="mt-5 max-w-3xl">
              <p
                ref={descRef}
                className={`text-sm leading-relaxed text-slate-300 transition-all ${
                  isDescExpanded ? "" : "line-clamp-4"
                }`}
              >
                {release.description}
              </p>
              {canExpand && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 rounded-md py-0.5"
                >
                  <span>{isDescExpanded ? "Свернуть" : "Развернуть описание"}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isDescExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {startEpisode ? (
            <Button
              variant="default"
              size="lg"
              onClick={() => onPlay(startEpisode)}
              className="gap-2.5 px-6"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>{playButtonText}</span>
            </Button>
          ) : (
            <Button disabled variant="secondary" size="lg">
              Эпизоды недоступны
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div
                className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold border transition-all cursor-pointer ${
                  currentCategory
                    ? "bg-rose-600/20 border-rose-500/40 text-rose-400"
                    : "bg-[#12131A] border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <Bookmark className="h-4 w-4" />
                <span>
                  {currentCategory ? CATEGORY_NAMES[currentCategory] : "Добавить в закладки"}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="left" className="w-48">
              {Object.entries(CATEGORY_NAMES).map(([cat, label]) => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => {
                    if (currentCategory === cat) {
                      onRemoveBookmark();
                    } else {
                      onBookmarkChange(cat as BookmarkCategory);
                    }
                  }}
                  className={currentCategory === cat ? "text-rose-400 font-bold" : ""}
                >
                  <span>{label}</span>
                  {currentCategory === cat && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
