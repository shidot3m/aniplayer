import { Bookmark, CheckCircle2, Play } from "lucide-react";
import { CDN_BASE_URL } from "../shared/lib/constants";
import { CATEGORY_NAMES } from "../shared/lib/releaseUtils";
import type { BookmarkCategory, Release } from "../shared/types";
import { Badge } from "../shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../shared/ui/dropdown-menu";
import { useCatalogStore } from "../store/catalogStore";

interface AnimeCardProps {
  release: Release;
  onClick: () => void;
}

export function AnimeCard({ release, onClick }: AnimeCardProps) {
  const { bookmarks, history, setBookmark, removeBookmark } = useCatalogStore();

  // Find current bookmark status
  let currentCategory: BookmarkCategory | null = null;
  for (const [cat, list] of Object.entries(bookmarks)) {
    if (list.some((b) => b.release_id === release.id)) {
      currentCategory = cat as BookmarkCategory;
      break;
    }
  }

  const isWatched =
    currentCategory === "WATCHED" ||
    Boolean(
      release.episodes &&
        release.episodes.length > 0 &&
        release.episodes.every((ep) =>
          history.some(
            (h) => h.release_id === release.id && h.episode_id === ep.id && h.is_completed,
          ),
        ),
    );

  const posterUrl =
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail || "";
  const formattedPoster =
    posterUrl.startsWith("http") || posterUrl.startsWith("data:")
      ? posterUrl
      : posterUrl
        ? `${CDN_BASE_URL}${posterUrl}`
        : "";

  const totalEps = release.episodes_total
    ? `${release.episodes_total} эп.`
    : release.episodes?.length
      ? `${release.episodes.length} эп.`
      : "Онгоинг";

  return (
    <div
      className={`group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border ${
        isWatched
          ? "border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20"
          : "border-white/10 hover:border-white/25"
      } bg-white/[0.02] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
    >
      {/* Clickable Card Action */}
      <button
        type="button"
        aria-label={`Открыть ${release.name.main}`}
        onClick={onClick}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      />

      {/* Poster Image */}
      {formattedPoster ? (
        <img
          src={formattedPoster}
          alt={release.name.main}
          loading="lazy"
          className="pointer-events-none h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // Fallback if image load fails
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      ) : (
        <div className="pointer-events-none flex h-full w-full items-center justify-center bg-gradient-to-br from-black to-[#121318] p-4 text-center">
          <span className="text-xs text-slate-400 line-clamp-3">{release.name.main}</span>
        </div>
      )}

      {/* Persistent Watched Visual Indicator (Always visible) */}
      {isWatched && (
        <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 backdrop-blur-xl shadow-lg shadow-black/40">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Просмотрено</span>
        </div>
      )}

      {/* Watched Bottom Accent Bar */}
      {isWatched && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/80 z-20" />
      )}

      {/* Top Badges - Only visible on hover */}
      <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between pointer-events-none z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
        {!isWatched && release.type?.description ? (
          <Badge
            variant="secondary"
            className="backdrop-blur-xl bg-black/70 text-[10px] py-0.5 px-2 border-white/15 text-white"
          >
            {release.type.description}
          </Badge>
        ) : (
          <div />
        )}
        <Badge
          variant="outline"
          className="backdrop-blur-xl bg-black/70 text-[10px] py-0.5 px-2 border-white/15 text-slate-200"
        >
          {totalEps}
        </Badge>
      </div>

      {/* Quick Bookmark Action Menu - Only visible on hover */}
      <div className="absolute right-2.5 top-10 z-20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-xl transition-colors ${
                currentCategory
                  ? "bg-rose-600 text-white"
                  : "bg-black/70 text-slate-300 hover:bg-white/20 hover:text-white border border-white/10"
              }`}
              title="Добавить в закладки"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="right"
            className="w-40 backdrop-blur-2xl bg-black/85 border-white/15"
          >
            {Object.entries(CATEGORY_NAMES).map(([cat, label]) => (
              <DropdownMenuItem
                key={cat}
                onClick={() => {
                  if (currentCategory === cat) {
                    removeBookmark(release.id);
                  } else {
                    setBookmark(release.id, cat as BookmarkCategory, release);
                  }
                }}
                className={currentCategory === cat ? "text-rose-400 font-semibold" : ""}
              >
                <span className="truncate">{label}</span>
                {currentCategory === cat && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hover Glass Darkening Overlay with Details - Only visible on hover */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none">
        <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight">
          {release.name.main}
        </h4>
        {(release.name.english || release.name.alternative) && (
          <p className="mt-0.5 text-[10px] text-slate-300 line-clamp-1">
            {release.name.english || release.name.alternative}
          </p>
        )}

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-white/15">
          <span>{release.year || "—"}</span>
          <span className="flex items-center gap-1.5 text-rose-400 group-hover:text-rose-300 font-medium">
            {isWatched ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">Пересмотреть</span>
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
    </div>
  );
}
