import { Sparkles } from "lucide-react";
import { CDN_BASE_URL } from "@/shared/lib/constants";
import type { GenreItem } from "@/shared/types";
import { useCatalogStore } from "../state/catalogStore";

interface GenreSelectorProps {
  selectedGenre: GenreItem | null;
  onSelectGenre: (genre: GenreItem | null) => void;
}

function formatGenreImageUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  return `${CDN_BASE_URL}${rawUrl}`;
}

export function GenreSelector({ selectedGenre, onSelectGenre }: GenreSelectorProps) {
  const genres = useCatalogStore((state) => state.genres);

  return (
    <section className="mb-12 pt-6 border-t border-white/5">
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
            Сбросить фильтр ({selectedGenre.name})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {genres.map((g: GenreItem) => {
          const isSelected = selectedGenre?.id === g.id;
          const imgUrl = formatGenreImageUrl(
            g.image?.optimized?.preview || g.image?.preview || g.image?.thumbnail,
          );

          return (
            <button
              key={g.id}
              type="button"
              aria-label={`Жанр ${g.name}`}
              onClick={() => onSelectGenre(isSelected ? null : g)}
              className={`group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 hover:-translate-y-1 hover:shadow-2xl ${
                isSelected
                  ? "border-rose-500 bg-rose-500/20 ring-2 ring-rose-500/40"
                  : "border-white/10 bg-white/[0.02] backdrop-blur-md hover:border-white/25 hover:shadow-rose-950/30"
              }`}
            >
              {/* Genre Background Image with exact 2:3 vertical poster proportions */}
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={g.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black to-[#121318]" />
              )}

              {/* Dark subtle gradient overlay to keep text readable */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

              {/* Genre info at bottom */}
              <div className="relative z-10 flex h-full flex-col justify-end">
                <span
                  className={`block text-sm font-bold leading-tight truncate drop-shadow ${
                    isSelected ? "text-rose-400" : "text-white group-hover:text-rose-300"
                  }`}
                >
                  {g.name}
                </span>
                {g.total_releases != null && (
                  <span className="block text-[11px] text-slate-300 mt-1 font-medium">
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
