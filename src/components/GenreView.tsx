import { ArrowLeft, Film, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useCatalogStore } from "../store/catalogStore";
import type { GenreItem, Release } from "../types";
import { AnimeCard } from "./AnimeCard";
import { GenrePagination } from "./GenrePagination";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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
    <div ref={topRef} className="mx-auto max-w-7xl px-6 py-6 pb-20">
      {/* Header bar */}
      <div className="mb-6 flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>В каталог</span>
          </Button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                <span>Жанр: {genre.name}</span>
                {genre.total_releases != null && (
                  <Badge variant="rose" className="h-5 px-1.5 text-[10px]">
                    {genre.total_releases}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-slate-400">Все аниме-релизы в выбранной категории</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick other genres horizontal bar */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1">Жанры:</span>
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
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isCurrent
                  ? "bg-rose-600 text-white font-semibold shadow-md shadow-rose-950/40"
                  : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10"
              }`}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Releases Grid / Loading State */}
      {isLoadingGenre ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
          <p className="text-xs text-slate-400">Загрузка аниме жанра «{genre.name}»...</p>
        </div>
      ) : genreReleases.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {genreReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md p-8 text-center">
          <Film className="h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">
            В жанре «{genre.name}» пока нет доступных релизов
          </h3>
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
