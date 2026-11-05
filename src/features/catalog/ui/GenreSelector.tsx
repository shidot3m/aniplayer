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
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink">Жанры</h3>
        {selectedGenre && (
          <button
            type="button"
            onClick={() => onSelectGenre(null)}
            className="cursor-pointer text-[13px] text-ink-2 transition-colors hover:text-ink"
          >
            Сбросить ({selectedGenre.name})
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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
              className={
                isSelected
                  ? "group relative cursor-pointer overflow-hidden rounded-xl outline outline-2 -outline-offset-2 outline-accent"
                  : "group relative cursor-pointer overflow-hidden rounded-xl outline outline-0 -outline-offset-2 outline-transparent transition-[outline-color] hover:outline-accent"
              }
            >
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover transition-transform group-hover:scale-[1.03]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.visibility = "hidden";
                  }}
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-end bg-surface-1 p-3" />
              )}

              {/* A neutral scrim keeps the label readable over the poster — the one allowed gradient. */}
              <div className="absolute inset-0 bg-linear-to-t from-scrim/90 via-scrim/30 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                <span className="block truncate text-sm font-medium text-ink">{g.name}</span>
                {g.total_releases != null && (
                  <span className="mt-0.5 block text-[11px] tabular-nums text-ink-2">
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
