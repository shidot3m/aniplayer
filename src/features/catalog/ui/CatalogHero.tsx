import { Bookmark, Check, Play } from "lucide-react";
import { CATEGORY_NAMES, findBookmarkCategory, formatPosterUrl } from "@/shared/lib/releaseUtils";
import type { BookmarkCategory, Release } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useCatalogStore } from "../state/catalogStore";

interface CatalogHeroProps {
  release: Release;
  onOpen: () => void;
}

/**
 * The catalog hero — an Apple TV key-art field: the featured Release named large, its meta line,
 * a short description and two actions, with the poster sitting on the tone field at the right.
 * There is no "trending" flag: the hero is the newest Release and speaks for itself (#69, ADR 0018).
 */
export function CatalogHero({ release, onOpen }: CatalogHeroProps) {
  const { bookmarks, setBookmark, removeBookmark } = useCatalogStore();
  const currentCategory = findBookmarkCategory(bookmarks, release.id);

  const posterUrl = formatPosterUrl(
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail,
  );

  const episodeCount = release.episodes_total || release.episodes?.length || 0;
  const genreLine = release.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");

  return (
    <section className="relative isolate flex min-h-[420px] items-end overflow-hidden bg-surface-1 px-12 pt-28 pb-14">
      <div className="flex w-full items-end gap-12">
        <div className="flex min-w-0 flex-1 flex-col justify-end lg:max-w-[720px]">
          <h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.02em] text-ink xl:text-5xl">
            {release.name.main}
          </h1>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            {release.type?.description && <span>{release.type.description}</span>}
            {release.year != null && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{release.year}</span>
              </>
            )}
            {episodeCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{episodeCount} эпизодов</span>
              </>
            )}
            {genreLine && (
              <>
                <span aria-hidden>·</span>
                <span className="text-ink-3">{genreLine}</span>
              </>
            )}
          </div>

          {release.description && (
            <p className="mt-4 line-clamp-3 max-w-[52ch] leading-relaxed text-[15px] text-ink-2">
              {release.description}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpen}
              className="flex cursor-pointer items-center gap-2.5 rounded-[10px] bg-ink px-6 py-3 text-sm font-semibold text-ground transition-[background-color,transform] hover:bg-ink-2 active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Смотреть</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger>
                <span className="flex items-center gap-2 rounded-[10px] border border-line bg-ink/10 px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink/15">
                  <Bookmark className="h-4 w-4" />
                  <span>{currentCategory ? CATEGORY_NAMES[currentCategory] : "В закладки"}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="left" className="w-44">
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

        {posterUrl && (
          <div className="hidden shrink-0 lg:block">
            <img
              src={posterUrl}
              alt=""
              aria-hidden
              className="h-[420px] rounded-[14px] object-cover shadow-art"
              onError={(e) => {
                (e.target as HTMLElement).style.visibility = "hidden";
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
