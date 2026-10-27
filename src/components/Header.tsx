import { Bookmark, FolderDown, Home, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useCatalogStore } from "@/features/catalog";
import { useDownloadStore } from "@/features/downloads";
import { Badge } from "../shared/ui/badge";
import { Button } from "../shared/ui/button";
import { Input } from "../shared/ui/input";

interface HeaderProps {
  onOpenSettings?: () => void;
}

function AniplayerLogoMark() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 shadow-md shadow-rose-900/30 border border-white/20 transition-transform group-hover:scale-105">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M16 4L27.5 27H21.5L16 15.5L10.5 27H4.5L16 4Z" fill="white" />
        <path d="M13.5 18L19.5 21.5L13.5 25V18Z" fill="#E11D48" />
      </svg>
    </div>
  );
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { activeScreen, setActiveScreen, bookmarks, searchQuery, setSearchQuery, performSearch } =
    useCatalogStore();
  const { downloadedEpisodes, activeDownloads } = useDownloadStore();

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
  const activeDownloadsCount = Object.values(activeDownloads).filter(
    (d) => d.status === "DOWNLOADING",
  ).length;

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-[#090A0F]/80 px-6 backdrop-blur-xl">
      {/* Left: Logo & Nav */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveScreen("home")}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-xl cursor-pointer"
        >
          <AniplayerLogoMark />
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

          <Button
            variant={activeScreen === "downloads" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveScreen("downloads")}
            className="gap-2 relative"
          >
            <FolderDown className="h-4 w-4 text-rose-400" />
            <span>Скачанные</span>
            {downloadedEpisodes.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] bg-white/10 text-slate-300"
              >
                {downloadedEpisodes.length}
              </Badge>
            )}
            {activeDownloadsCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            )}
          </Button>
        </nav>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative w-full">
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
            className="pl-9 pr-8 bg-white/5 border-white/10 text-xs h-9 focus:border-rose-500 rounded-xl backdrop-blur-md"
          />
          {localQuery && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => {
                setLocalQuery("");
                setSearchQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions / Settings */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenSettings}
          title="Настройки"
          className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md"
        >
          <Settings className="h-4 w-4 text-slate-300" />
        </Button>
      </div>
    </header>
  );
}
