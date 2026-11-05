import { Bookmark, FolderDown, Home, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useCatalogStore } from "@/features/catalog";
import { useDownloadStore } from "@/features/downloads";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface HeaderProps {
  onOpenSettings?: () => void;
}

function AniplayerLogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M16 4L27.5 27H21.5L16 15.5L10.5 27H4.5L16 4Z" className="fill-ink" />
        <path d="M13.5 18L19.5 21.5L13.5 25V18Z" className="fill-accent" />
      </svg>
    </span>
  );
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { activeScreen, setActiveScreen, bookmarks, searchQuery, setSearchQuery, performSearch } =
    useCatalogStore();
  const { downloadedEpisodes, activeDownloads } = useDownloadStore();

  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounce the search query so a keystroke does not hit the API.
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
    <header className="sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-line bg-ground px-6">
      {/* Left: Logo & Nav */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveScreen("home")}
          className="group flex cursor-pointer items-center gap-2.5 rounded-lg text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <AniplayerLogoMark />
          <span className="text-base font-semibold tracking-[-0.01em] text-ink">Aniplayer</span>
        </button>

        <nav className="flex items-center gap-1">
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
            className="gap-2"
          >
            <Bookmark className="h-4 w-4" />
            <span>Закладки</span>
            {totalBookmarks > 0 && (
              <span className="tabular-nums text-[11px] text-ink-3">{totalBookmarks}</span>
            )}
          </Button>

          <Button
            variant={activeScreen === "downloads" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveScreen("downloads")}
            className="gap-2"
          >
            <FolderDown className="h-4 w-4" />
            <span>Загрузки</span>
            {downloadedEpisodes.length > 0 && (
              <span className="tabular-nums text-[11px] text-ink-3">
                {downloadedEpisodes.length}
              </span>
            )}
            {activeDownloadsCount > 0 && (
              <span className="tabular-nums text-[11px] text-accent-ink">
                {activeDownloadsCount}
              </span>
            )}
          </Button>
        </nav>
      </div>

      {/* Center: Search Bar */}
      <div className="mx-6 max-w-md flex-1">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              if (activeScreen !== "home" && e.target.value.trim().length > 0) {
                setActiveScreen("home");
              }
            }}
            placeholder="Поиск"
            className="h-9 border-line bg-surface-1 pl-9 pr-8 text-sm"
          />
          {localQuery && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => {
                setLocalQuery("");
                setSearchQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded text-ink-3 transition-colors hover:text-ink focus:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-ink"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions / Settings */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSettings}
        aria-label="Настройки"
        title="Настройки"
        className="text-ink-2 hover:text-ink"
      >
        <Settings className="h-5 w-5" />
      </Button>
    </header>
  );
}
