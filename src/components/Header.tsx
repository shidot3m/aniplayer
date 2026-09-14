import { Bookmark, Film, Home, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useCatalogStore } from "../store/catalogStore";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface HeaderProps {
  onOpenSettings?: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { activeScreen, setActiveScreen, bookmarks, searchQuery, setSearchQuery, performSearch } =
    useCatalogStore();

  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
      if (localQuery.trim().length > 0) {
        performSearch(localQuery.trim());
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, setSearchQuery, performSearch]);

  const totalBookmarks = Object.values(bookmarks).reduce((acc, list) => acc + list.length, 0);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#090A0F]/80 px-6 backdrop-blur-md">
      {/* Left: Logo & Nav */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveScreen("home")}
          className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-900/30 transition-transform group-hover:scale-105">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">
              Ani<span className="text-rose-500">player</span>
            </span>
            <span className="block text-[10px] text-slate-400 -mt-0.5">4K Anime Player</span>
          </div>
        </button>

        <nav className="flex items-center gap-2">
          <Button
            variant={activeScreen === "home" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveScreen("home")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Каталог</span>
          </Button>

          <Button
            variant={activeScreen === "bookmarks" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveScreen("bookmarks")}
            className="gap-2 relative"
          >
            <Bookmark className="h-4 w-4 text-rose-400" />
            <span>Закладки</span>
            {totalBookmarks > 0 && (
              <Badge variant="rose" className="h-5 px-1.5 text-[10px]">
                {totalBookmarks}
              </Badge>
            )}
          </Button>
        </nav>
      </div>

      {/* Center: Search Bar */}
      <div className="relative w-72 md:w-96">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              if (activeScreen !== "home" && e.target.value.trim().length > 0) {
                setActiveScreen("home");
              }
            }}
            placeholder="Поиск аниме по названию..."
            className="pl-9 pr-8 bg-[#12131A] border-white/10 text-xs h-9 focus:border-rose-500"
          />
          {localQuery && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => {
                setLocalQuery("");
                setSearchQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: Quick Settings */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenSettings}
          title="Настройки"
          className="rounded-xl border-white/10 hover:bg-white/10"
        >
          <Settings className="h-4 w-4 text-slate-300" />
        </Button>
      </div>
    </header>
  );
}
