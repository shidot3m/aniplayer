import { Bookmark, Check } from "lucide-react";
import { useRef } from "react";
import {
  CATEGORY_NAMES,
  findBookmarkCategory,
  formatPosterUrl,
  isReleaseWatched,
} from "@/shared/lib/releaseUtils";
import type { BookmarkCategory, Release } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useCatalogStore } from "../state/catalogStore";

interface AnimeCardProps {
  release: Release;
  onClick: () => void;
}

export function AnimeCard({ release, onClick }: AnimeCardProps) {
  const { bookmarks, history, setBookmark, removeBookmark } = useCatalogStore();
  const posterRef = useRef<HTMLImageElement>(null);

  const currentCategory = findBookmarkCategory(bookmarks, release.id);
  const isWatched = isReleaseWatched(release, history, currentCategory);

  const posterUrl = formatPosterUrl(
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail,
  );

  const episodeCount = release.episodes_total || release.episodes?.length || 0;
  const typeLabel = release.type?.description || "";

  // The poster takes its shared-element name only at the moment it is the source of a navigation,
  // so the same Release appearing in several rails never collides on one view-transition-name
  // (a duplicate aborts the transition). The Release hero carries the matching name. (#71)
  const open = () => {
    if (posterRef.current) posterRef.current.style.viewTransitionName = `poster-${release.id}`;
    onClick();
  };

  return (
    <div className="group relative w-full">
      <button
        type="button"
        aria-label={`Открыть ${release.name.main}`}
        onClick={open}
        className="block w-full cursor-pointer rounded-xl text-left focus:outline-hidden"
      >
        {posterUrl ? (
          <img
            ref={posterRef}
            src={posterUrl}
            alt={release.name.main}
            loading="lazy"
            className="pointer-events-none aspect-[2/3] w-full rounded-xl bg-surface-1 object-cover outline-2 -outline-offset-2 outline-transparent transition-[transform,box-shadow,outline-color] group-hover:z-10 group-hover:scale-[1.06] group-hover:shadow-lift group-hover:outline-accent group-focus-within:scale-[1.06] group-focus-within:outline-accent"
            onError={(e) => {
              (e.target as HTMLElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-surface-1 p-3 text-center text-xs text-ink-2">
            {release.name.main}
          </div>
        )}

        <div className="px-0.5 pt-2.5">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-ink">
            {release.name.main}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-3">
            {typeLabel && <span className="text-ink-2">{typeLabel}</span>}
            {typeLabel && release.year != null && <span aria-hidden>·</span>}
            {release.year != null && <span>{release.year}</span>}
            {episodeCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{episodeCount} эп.</span>
              </>
            )}
          </div>
        </div>
      </button>

      {isWatched && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[64px] left-0.5 h-0.5 w-8 rounded-full bg-accent"
        />
      )}

      <div className="absolute right-1.5 top-1.5 z-20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            ariaLabel="Добавить в закладки"
            title={currentCategory ? CATEGORY_NAMES[currentCategory] : "В закладки"}
          >
            <span
              className={
                currentCategory
                  ? "flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-ink"
                  : "flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-scrim/70 text-ink shadow-float"
              }
            >
              <Bookmark className="h-4 w-4" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-44">
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
                className={currentCategory === cat ? "text-accent-ink" : ""}
              >
                <span className="truncate">{label}</span>
                {currentCategory === cat && <Check className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
