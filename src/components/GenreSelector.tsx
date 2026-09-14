import { Layers, Sparkles } from "lucide-react";
import { useCatalogStore } from "../store/catalogStore";
import type { GenreItem } from "../types";

interface GenreSelectorProps {
  selectedGenre: string | null;
  onSelectGenre: (genre: string | null) => void;
}

function formatGenreImageUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  return `https://aniliberty.top${rawUrl}`;
}

export function GenreSelector({ selectedGenre, onSelectGenre }: GenreSelectorProps) {
  const genres = useCatalogStore((state) => state.genres);

  return (
    <section className="mb-10 pt-4 border-t border-white/5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-500" />
            <span>Жанры</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Каталог категорий и тематических подборок</p>
        </div>

        {selectedGenre && (
          <button
            type="button"
            onClick={() => onSelectGenre(null)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Сбросить фильтр ({selectedGenre})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {/* All Releases Card */}
        <button
          type="button"
          aria-label="Все жанры"
          onClick={() => onSelectGenre(null)}
          className={`group relative flex h-24 w-full flex-col justify-end overflow-hidden rounded-xl border p-3 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            selectedGenre === null
              ? "border-rose-500 bg-[#1A131F]"
              : "border-white/5 bg-[#12131A] hover:border-white/20 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-rose-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Все жанры</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Полный каталог</div>
            </div>
          </div>
        </button>

        {/* API Genre Cards */}
        {genres.map((g: GenreItem) => {
          const isSelected = selectedGenre?.toLowerCase() === g.name.toLowerCase();
          const imgUrl = formatGenreImageUrl(
            g.image?.optimized?.preview || g.image?.preview || g.image?.thumbnail,
          );

          return (
            <button
              key={g.id}
              type="button"
              aria-label={`Жанр ${g.name}`}
              onClick={() => onSelectGenre(isSelected ? null : g.name)}
              className={`group relative flex h-24 w-full flex-col justify-end overflow-hidden rounded-xl border p-3 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isSelected
                  ? "border-rose-500 bg-[#1A131F]"
                  : "border-white/5 bg-[#12131A] hover:border-white/20 hover:-translate-y-0.5"
              }`}
            >
              {/* Genre Background Image */}
              {imgUrl && (
                <img
                  src={imgUrl}
                  alt={g.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-45"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              )}

              {/* Dark subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F]/95 via-[#090A0F]/60 to-transparent" />

              {/* Genre info */}
              <div className="relative z-10">
                <span
                  className={`block text-xs font-bold leading-tight truncate ${
                    isSelected ? "text-rose-400" : "text-white group-hover:text-rose-300"
                  }`}
                >
                  {g.name}
                </span>
                {g.total_releases != null && (
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {g.total_releases} {getReleasesDeclension(g.total_releases)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getReleasesDeclension(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return "релизов";
  if (mod10 === 1) return "релиз";
  if (mod10 >= 2 && mod10 <= 4) return "релиза";
  return "релизов";
}
