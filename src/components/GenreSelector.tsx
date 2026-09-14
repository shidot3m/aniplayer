import { Sparkles } from "lucide-react";

interface GenreSelectorProps {
  selectedGenre: string | null;
  onSelectGenre: (genre: string | null) => void;
}

const POPULAR_GENRES = [
  "Все",
  "Экшен",
  "Комедия",
  "Фэнтези",
  "Приключения",
  "Романтика",
  "Детектив",
  "Сёнэн",
  "Драма",
  "Повседневность",
  "Фантастика",
  "Магия",
  "Сверхъестественное",
  "Психология",
];

export function GenreSelector({ selectedGenre, onSelectGenre }: GenreSelectorProps) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rose-500" />
          Жанры
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {POPULAR_GENRES.map((g) => {
          const isSelected = (g === "Все" && selectedGenre === null) || selectedGenre === g;

          return (
            <button
              key={g}
              type="button"
              onClick={() => onSelectGenre(g === "Все" ? null : g)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                  : "bg-[#12131A] text-slate-300 border border-white/5 hover:border-white/20 hover:text-white"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
    </section>
  );
}
