import { ArrowLeft, Bookmark, FolderHeart, Search } from "lucide-react";
import { useState } from "react";
import { AnimeCard, useCatalogStore } from "@/features/catalog";
import type { BookmarkCategory, Release } from "../shared/types";
import { Badge } from "../shared/ui/badge";
import { Button } from "../shared/ui/button";
import { Input } from "../shared/ui/input";

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
    <div className="mx-auto max-w-7xl px-6 py-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveScreen("home")}
            className="gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Каталог</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-rose-500" />
            Мои закладки
          </h1>
        </div>

        {/* Filter within bookmarks */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Фильтр по названию..."
            className="pl-9 bg-[#12131A] border-white/10 text-xs h-9"
          />
        </div>
      </div>

      {/* 7 Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const count = bookmarks[cat.id]?.length || 0;
          const isSelected = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? "bg-rose-600 text-white"
                  : "bg-[#12131A] text-slate-400 border border-white/5 hover:border-white/20 hover:text-white"
              }`}
            >
              <span>{cat.label}</span>
              <Badge
                variant={isSelected ? "secondary" : "outline"}
                className={`h-5 px-1.5 text-[10px] ${
                  isSelected ? "bg-black/40 text-white border-0" : "text-slate-400 border-white/10"
                }`}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Grid of releases */}
      {filteredReleases.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md p-8 text-center">
          <FolderHeart className="h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">
            В категории «{CATEGORIES.find((c) => c.id === activeCategory)?.label}» пока пусто
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            Добавляйте интересные тайтлы в закладки из каталога, чтобы быстро возвращаться к
            просмотру.
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
