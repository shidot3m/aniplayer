import { Film, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimeCard } from "./components/AnimeCard";
import { BookmarksView } from "./components/BookmarksView";
import { ContinueWatching } from "./components/ContinueWatching";
import { GenreSelector } from "./components/GenreSelector";
import { GenreView } from "./components/GenreView";
import { Header } from "./components/Header";
import { PlayerOverlay } from "./components/player/PlayerOverlay";
import { ReleaseDetails } from "./components/ReleaseDetails";
import { ReleaseSchedule } from "./components/ReleaseSchedule";
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
    selectReleaseWithDetails,
    latestReleases,
    searchResults,
    isSearching,
    searchQuery,
    selectedGenre,
    selectGenre,
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

  const [previousScreen, setPreviousScreen] = useState<"home" | "bookmarks" | "genre">("home");
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
    if (activeScreen !== "details") {
      setPreviousScreen(activeScreen);
    }
    selectReleaseWithDetails(release);
  };

  // Determine which releases to display in the main grid
  const displayedReleases = searchQuery.trim() ? searchResults : latestReleases;

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
    <div className="flex h-screen w-full flex-col bg-[#090A0F] text-slate-100 font-sans selection:bg-rose-600 selection:text-white overflow-hidden">
      {/* Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeScreen === "home" && (
          <div className="mx-auto max-w-7xl px-6 py-6">
            {/* Continue Watching Section */}
            {!searchQuery && <ContinueWatching onSelectRelease={handleSelectRelease} />}

            {/* Releases Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <Film className="h-4 w-4 text-rose-500" />
                {searchQuery ? `Результаты поиска (${searchResults.length})` : "Свежие релизы"}
              </h2>
            </div>

            {/* Loading / Grid */}
            {isSearching ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              </div>
            ) : displayedReleases.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-12">
                {displayedReleases.map((release) => (
                  <AnimeCard
                    key={release.id}
                    release={release}
                    onClick={() => handleSelectRelease(release)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md text-center mb-12">
                <p className="text-sm text-slate-400">Релизы не найдены</p>
              </div>
            )}

            {/* Release Schedule Section (Section 5.3 of spec) */}
            {!searchQuery && latestReleases.length > 0 && (
              <ReleaseSchedule releases={latestReleases} onSelectRelease={handleSelectRelease} />
            )}

            {/* Genres Section at the End */}
            {!searchQuery && (
              <GenreSelector selectedGenre={selectedGenre} onSelectGenre={selectGenre} />
            )}
          </div>
        )}

        {activeScreen === "genre" && selectedGenre && (
          <GenreView
            genre={selectedGenre}
            onSelectRelease={handleSelectRelease}
            onBack={() => {
              selectGenre(null);
              setActiveScreen("home");
            }}
          />
        )}

        {activeScreen === "bookmarks" && <BookmarksView onSelectRelease={handleSelectRelease} />}

        {activeScreen === "details" && selectedRelease && (
          <ReleaseDetails
            release={selectedRelease}
            onBack={() => setActiveScreen(previousScreen)}
          />
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
                  className={`rounded-xl px-3 py-2.5 text-left border transition-all cursor-pointer ${
                    anime4kPreset === p.id
                      ? "border-rose-500 bg-rose-500/15 text-white font-semibold shadow-sm"
                      : "border-white/10 bg-white/[0.03] backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* GPU Hardware Acceleration Status */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-md flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Аппаратное декодирование (GPU)</div>
              <div className="text-[11px] text-slate-400">
                Direct3D 11 (d3d11va) • Zero-copy playback
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
              Активно
            </span>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="group-hover:text-white transition-colors">
                Автопропуск опенингов и эндингов
              </span>
              <input
                type="checkbox"
                checked={autoSkipOpEd}
                onChange={(e) => setAutoSkipOpEd(e.target.checked)}
                className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <span className="group-hover:text-white transition-colors">
                Автопереход к следующему эпизоду
              </span>
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
