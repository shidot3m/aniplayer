import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { GenreItem, Release } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { useCatalogStore } from "../state/catalogStore";
import { AnimeCard } from "./AnimeCard";
import { GenrePagination } from "./GenrePagination";

interface GenreViewProps {
  genre: GenreItem;
  onSelectRelease: (release: Release) => void;
  onBack: () => void;
}

export function GenreView({ genre, onSelectRelease, onBack }: GenreViewProps) {
  const {
    genreReleases,
    genrePage,
    genreTotalPages,
    isLoadingGenre,
    genres,
    selectGenre,
    loadGenrePage,
  } = useCatalogStore();

  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [scrollToTop]);

  const totalPages = Math.max(1, genreTotalPages);

  const changePage = (page: number) => {
    if (page < 1 || page > totalPages || page === genrePage || isLoadingGenre) return;
    scrollToTop();
    loadGenrePage(page);
  };

  return (
    <div ref={topRef} className="px-12 py-6 pb-20">
      {/* Header bar */}
      <div className="mb-6 flex items-center gap-4 border-b border-line pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>В каталог</span>
        </Button>

        <div className="flex items-baseline gap-2.5">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{genre.name}</h2>
          {genre.total_releases != null && (
            <span className="text-[13px] tabular-nums text-ink-3">{genre.total_releases}</span>
          )}
        </div>
      </div>

      {/* Quick other genres horizontal bar */}
      <div className="no-scrollbar mb-8 flex items-center gap-2 overflow-x-auto pb-1">
        {genres.map((g) => {
          const isCurrent = g.id === genre.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                scrollToTop();
                selectGenre(g);
              }}
              className={
                isCurrent
                  ? "shrink-0 cursor-pointer rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-[13px] font-medium text-accent-ink"
                  : "shrink-0 cursor-pointer rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
              }
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Releases Grid / Loading State */}
      {isLoadingGenre ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-ink" />
          <p className="text-sm text-ink-2">Загрузка жанра «{genre.name}»…</p>
        </div>
      ) : genreReleases.length > 0 ? (
        <div className="grid grid-cols-3 gap-x-5 gap-y-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {genreReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center py-16 text-center">
          <h3 className="text-sm font-medium text-ink">В жанре «{genre.name}» пока нет релизов</h3>
          <Button variant="secondary" size="sm" onClick={onBack} className="mt-4">
            Вернуться в каталог
          </Button>
        </div>
      )}

      <GenrePagination
        currentPage={genrePage}
        totalPages={totalPages}
        disabled={isLoadingGenre}
        onPageChange={changePage}
      />
    </div>
  );
}
