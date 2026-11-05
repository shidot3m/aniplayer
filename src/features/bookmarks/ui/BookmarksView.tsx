import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";
import { AnimeCard, useCatalogStore } from "@/features/catalog";
import type { BookmarkCategory, Release } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface BookmarksViewProps {
  onSelectRelease: (release: Release) => void;
}

const CATEGORIES: { id: BookmarkCategory; label: string }[] = [
  { id: "WATCHING", label: "Смотрю" },
  { id: "PLANNED", label: "В планах" },
  { id: "POSTPONED", label: "Отложено" },
  { id: "ABANDONED", label: "Брошено" },
  { id: "NOT_INTERESTED", label: "Не интересно" },
  { id: "FAVORITES", label: "Любимое" },
  { id: "WATCHED", label: "Просмотрено" },
];

export function BookmarksView({ onSelectRelease }: BookmarksViewProps) {
  const { bookmarks, setActiveScreen } = useCatalogStore();
  const [activeCategory, setActiveCategory] = useState<BookmarkCategory>("WATCHING");
  const [query, setQuery] = useState("");

  const currentList = bookmarks[activeCategory] || [];

  // Parse release objects from bookmark JSON
  const parsedReleases: Release[] = currentList
    .map((b) => {
      try {
        return JSON.parse(b.release_data_json) as Release;
      } catch (_e) {
        return null;
      }
    })
    .filter((r): r is Release => r !== null);

  // Filter by search query within bookmarks
  const filteredReleases = query.trim()
    ? parsedReleases.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.name.main.toLowerCase().includes(q) ||
          r.name.english?.toLowerCase().includes(q) ||
          r.name.alternative?.toLowerCase().includes(q)
        );
      })
    : parsedReleases;

  return (
    <div className="px-12 py-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveScreen("home")}
            className="gap-2 text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Каталог</span>
          </Button>
          <span aria-hidden className="h-4 w-px bg-line" />
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">Закладки</h1>
        </div>

        {/* Filter within bookmarks */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Фильтр по названию"
            className="h-9 border-line bg-surface-1 pl-9 text-sm"
          />
        </div>
      </div>

      {/* 7 Category Tabs */}
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-3">
        {CATEGORIES.map((cat) => {
          const count = bookmarks[cat.id]?.length || 0;
          const isSelected = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={
                isSelected
                  ? "-mb-3 flex cursor-pointer items-baseline gap-2 border-b-2 border-accent pb-2 text-sm font-medium text-ink"
                  : "-mb-3 flex cursor-pointer items-baseline gap-2 border-b-2 border-transparent pb-2 text-sm text-ink-2 transition-colors hover:text-ink"
              }
            >
              <span>{cat.label}</span>
              <span className="text-[12px] tabular-nums text-ink-3">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of releases */}
      {filteredReleases.length > 0 ? (
        <div className="grid grid-cols-3 gap-x-5 gap-y-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center py-16 text-center">
          <h3 className="text-sm font-medium text-ink">
            В категории «{CATEGORIES.find((c) => c.id === activeCategory)?.label}» пока пусто
          </h3>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            Добавляйте релизы в закладки из каталога, чтобы быстро возвращаться к просмотру.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveScreen("home")}
            className="mt-4"
          >
            Перейти в каталог
          </Button>
        </div>
      )}
    </div>
  );
}
