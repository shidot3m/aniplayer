import { Film, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimeCard } from "./components/AnimeCard";
import { BookmarksView } from "./components/BookmarksView";
import { ContinueWatching } from "./components/ContinueWatching";
import { GenreSelector } from "./components/GenreSelector";
import { Header } from "./components/Header";
import { PlayerOverlay } from "./components/player/PlayerOverlay";
import { ReleaseDetails } from "./components/ReleaseDetails";
import { Dialog, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Slider } from "./components/ui/slider";
import { useCatalogStore } from "./store/catalogStore";
import { usePlayerStore } from "./store/playerStore";
import type { Release } from "./types";

export default function App() {
  const {
    activeScreen,
    setActiveScreen,
    selectedRelease,
    setSelectedRelease,
    latestReleases,
    searchResults,
    isSearching,
    searchQuery,
    loadInitialData,
  } = useCatalogStore();

  const {
    isPlayerOpen,
    closePlayer,
    currentRelease,
    currentEpisode,
    volume,
    setVolume,
    autoSkipOpEd,
    setAutoSkipOpEd,
    autoplayNext,
    setAutoplayNext,
    anime4kPreset,
    setAnime4kPreset,
    syncWithBackend,
  } = usePlayerStore();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Periodic player sync with backend
  useEffect(() => {
    const interval = setInterval(() => {
      syncWithBackend();
    }, 500);
    return () => clearInterval(interval);
  }, [syncWithBackend]);

  const handleSelectRelease = (release: Release) => {
    setSelectedRelease(release);
    setActiveScreen("details");
  };

  // Determine which releases to display in the main grid
  const displayedReleases = searchQuery.trim()
    ? searchResults
    : selectedGenre
      ? latestReleases.filter((r) =>
          r.genres?.some((g) => g.name.toLowerCase() === selectedGenre.toLowerCase()),
        )
      : latestReleases;

  if (isPlayerOpen && currentRelease && currentEpisode) {
    return (
      <PlayerOverlay
        release={currentRelease}
        episode={currentEpisode}
        onBack={() => {
          closePlayer();
          if (selectedRelease) {
            setActiveScreen("details");
          } else {
            setActiveScreen("home");
          }
        }}
        onGoToRelease={() => {
          setSelectedRelease(currentRelease);
          setActiveScreen("details");
          closePlayer();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen w-screen flex-col bg-[#090A0F] text-slate-100 font-sans selection:bg-rose-600 selection:text-white">
      {/* Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeScreen === "home" && (
          <div className="mx-auto max-w-7xl px-6 py-6">
            {/* Continue Watching Section */}
            {!searchQuery && <ContinueWatching onSelectRelease={handleSelectRelease} />}

            {/* Genres Filter */}
            {!searchQuery && (
              <GenreSelector selectedGenre={selectedGenre} onSelectGenre={setSelectedGenre} />
            )}

            {/* Releases Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <Film className="h-4 w-4 text-rose-500" />
                {searchQuery
                  ? `Результаты поиска (${searchResults.length})`
                  : selectedGenre
                    ? `Жанр: ${selectedGenre}`
                    : "Свежие релизы"}
              </h2>
            </div>

            {/* Loading / Grid */}
            {isSearching ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              </div>
            ) : displayedReleases.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {displayedReleases.map((release) => (
                  <AnimeCard
                    key={release.id}
                    release={release}
                    onClick={() => handleSelectRelease(release)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#12131A]/30 text-center">
                <p className="text-sm text-slate-400">Релизы не найдены</p>
              </div>
            )}
          </div>
        )}

        {activeScreen === "bookmarks" && <BookmarksView onSelectRelease={handleSelectRelease} />}

        {activeScreen === "details" && selectedRelease && (
          <ReleaseDetails release={selectedRelease} onBack={() => setActiveScreen("home")} />
        )}
      </main>

      {/* Quick Settings Dialog */}
      <Dialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Настройки воспроизведения</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-xs text-slate-300">
          {/* Volume */}
          <div>
            <div className="flex justify-between mb-2 font-medium">
              <span>Громкость по умолчанию</span>
              <span className="text-rose-400 font-bold">{volume}%</span>
            </div>
            <Slider value={volume} min={0} max={100} step={1} onChange={setVolume} />
          </div>

          {/* Anime4K Preset */}
          <div>
            <span className="block mb-2 font-medium">Пресет Anime4K</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "Mode A+A (HQ)", label: "Mode A+A (HQ)" },
                { id: "Mode A (Fast)", label: "Mode A (Fast)" },
                { id: "Mode B+B (HQ)", label: "Mode B+B (HQ)" },
                { id: "Mode C+A (HQ)", label: "Mode C+A (HQ)" },
                { id: "Off", label: "Отключено" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAnime4kPreset(p.id)}
                  className={`rounded-lg px-3 py-2 text-left border transition-all cursor-pointer ${
                    anime4kPreset === p.id
                      ? "border-rose-500 bg-rose-500/10 text-white font-semibold"
                      : "border-white/10 bg-[#12131A] text-slate-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Автопропуск опенингов и эндингов</span>
              <input
                type="checkbox"
                checked={autoSkipOpEd}
                onChange={(e) => setAutoSkipOpEd(e.target.checked)}
                className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span>Автопереход к следующей серии</span>
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => setAutoplayNext(e.target.checked)}
                className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
