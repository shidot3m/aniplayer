import { Bookmark, Play } from "lucide-react";
import { useCatalogStore } from "../store/catalogStore";
import type { BookmarkCategory, Release } from "../types";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface AnimeCardProps {
  release: Release;
  onClick: () => void;
}

const CATEGORY_NAMES: Record<BookmarkCategory, string> = {
  WATCHING: "Смотрю",
  PLANNED: "В планах",
  POSTPONED: "Отложено",
  ABANDONED: "Брошено",
  NOT_INTERESTED: "Не интересно",
  FAVORITES: "Любимое",
  WATCHED: "Просмотрено",
};

export function AnimeCard({ release, onClick }: AnimeCardProps) {
  const { bookmarks, setBookmark, removeBookmark } = useCatalogStore();

  // Find current bookmark status
  let currentCategory: BookmarkCategory | null = null;
  for (const [cat, list] of Object.entries(bookmarks)) {
    if (list.some((b) => b.release_id === release.id)) {
      currentCategory = cat as BookmarkCategory;
      break;
    }
  }

  const posterUrl =
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail || "";
  const formattedPoster =
    posterUrl.startsWith("http") || posterUrl.startsWith("data:")
      ? posterUrl
      : posterUrl
        ? `https://aniliberty.top${posterUrl}`
        : "";

  const totalEps = release.episodes_total
    ? `${release.episodes_total} эп.`
    : release.episodes?.length
      ? `${release.episodes.length} эп.`
      : "Онгоинг";

  return (
    <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/5 bg-[#12131A] shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-black/50">
      {/* Clickable Card Action */}
      <button
        type="button"
        aria-label={`Открыть ${release.name.main}`}
        onClick={onClick}
        className="absolute inset-0 z-0 h-full w-full cursor-pointer rounded-xl bg-transparent border-0 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      />

      {/* Poster Image */}
      {formattedPoster ? (
        <img
          src={formattedPoster}
          alt={release.name.main}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // Fallback if image load fails
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-[#12131A] p-4 text-center">
          <span className="text-xs text-slate-500 line-clamp-3">{release.name.main}</span>
        </div>
      )}

      {/* Top Badges */}
      <div className="absolute left-2 right-2 top-2 flex items-center justify-between pointer-events-none z-10">
        {release.type?.description ? (
          <Badge
            variant="secondary"
            className="backdrop-blur-md bg-black/60 text-[10px] py-0.5 px-1.5 border-white/10"
          >
            {release.type.description}
          </Badge>
        ) : (
          <div />
        )}
        <Badge
          variant="outline"
          className="backdrop-blur-md bg-black/60 text-[10px] py-0.5 px-1.5 border-white/10 text-slate-200"
        >
          {totalEps}
        </Badge>
      </div>

      {/* Quick Bookmark Action Menu */}
      <div className="absolute right-2 top-8 z-20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur-md transition-colors ${
                currentCategory
                  ? "bg-rose-600 text-white"
                  : "bg-black/70 text-slate-300 hover:bg-white/20 hover:text-white"
              }`}
              title="Добавить в закладки"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-40">
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

      {/* Hover Darkening Overlay with Details */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-[#090A0F] via-[#090A0F]/80 to-transparent p-3 opacity-90 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow">
          {release.name.main}
        </h4>
        {(release.name.english || release.name.alternative) && (
          <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
            {release.name.english || release.name.alternative}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/10">
          <span>{release.year || "—"}</span>
          <span className="flex items-center gap-1 text-rose-400 group-hover:text-rose-300 font-medium">
            <Play className="h-2.5 w-2.5 fill-current" />
            Смотреть
          </span>
        </div>
      </div>
    </div>
  );
}
