import { Bookmark, Check, Play } from "lucide-react";
import { CATEGORY_NAMES, formatPosterUrl } from "@/shared/lib/releaseUtils";
import type { BookmarkCategory, EpisodeItem, Release } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface ReleaseHeroProps {
  release: Release;
  currentCategory: BookmarkCategory | null;
  startEpisode: EpisodeItem | null;
  playButtonText: string;
  onPlay: (ep: EpisodeItem) => void;
  onBookmarkChange: (cat: BookmarkCategory) => void;
  onRemoveBookmark: () => void;
}

/**
 * The Release page key-art hero, in the catalog's language (#70, ADR 0018): the original name and
 * the Russian title large, a meta line, genres as quiet text, a short description, two actions and
 * the poster on the tone field at the right. No badges, no chips.
 */
export function ReleaseHero({
  release,
  currentCategory,
  startEpisode,
  playButtonText,
  onPlay,
  onBookmarkChange,
  onRemoveBookmark,
}: ReleaseHeroProps) {
  const posterUrl = formatPosterUrl(
    release.poster?.src || release.poster?.preview || release.poster?.thumbnail,
  );

  const originalName = release.name.english || release.name.alternative;
  const episodeCount = release.episodes_total || release.episodes?.length || 0;
  const genreLine = release.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative isolate flex min-h-[360px] items-end overflow-hidden bg-surface-1 px-12 pt-24 pb-10">
      <div className="flex w-full items-end gap-12">
        <div className="flex min-w-0 flex-1 flex-col justify-end lg:max-w-[760px]">
          {originalName && <p className="mb-2 text-[15px] text-ink-2">{originalName}</p>}
          <h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.02em] text-ink">
            {release.name.main}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
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
          </div>

          {genreLine && <p className="mt-1.5 text-sm text-ink-3">{genreLine}</p>}

          {release.description && (
            <p className="mt-4 line-clamp-4 max-w-[56ch] text-[14.5px] leading-relaxed text-ink-2">
              {release.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {startEpisode ? (
              <button
                type="button"
                onClick={() => onPlay(startEpisode)}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] bg-ink px-6 py-3 text-sm font-semibold text-ground transition-[background-color,transform] hover:bg-ink-2 active:scale-[0.98] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{playButtonText}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center gap-2.5 rounded-[10px] bg-ink/10 px-6 py-3 text-sm font-semibold text-ink-3"
              >
                Эпизоды недоступны
              </button>
            )}

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
                        onRemoveBookmark();
                      } else {
                        onBookmarkChange(cat as BookmarkCategory);
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
              alt={release.name.main}
              style={{ viewTransitionName: `poster-${release.id}` }}
              className="h-[310px] rounded-[14px] object-cover shadow-art"
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
