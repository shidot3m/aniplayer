import { Film, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AnimeCard,
  GenreSelector,
  GenreView,
  ReleaseSchedule,
  useCatalogStore,
} from "@/features/catalog";
import { ContinueWatching } from "@/features/continue-watching";
import { ReleaseDetails } from "@/features/release";
import { BookmarksView } from "./components/BookmarksView";
import { DownloadFloatingWidget } from "./components/DownloadFloatingWidget";
import { DownloadsView } from "./components/DownloadsView";
import { Header } from "./components/Header";
import { PlayerOverlay } from "./components/player/PlayerOverlay";
import { SettingsDialog } from "./components/SettingsDialog";
import type { Release } from "./shared/types";
import { useDownloadStore } from "./store/downloadStore";
import { usePlayerStore } from "./store/playerStore";

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
    syncWithBackend,
    initSettings,
  } = usePlayerStore();

  const { listenToProgress, fetchDownloadedEpisodes } = useDownloadStore();

  const [previousScreen, setPreviousScreen] = useState<
    "home" | "bookmarks" | "genre" | "downloads"
  >("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
    initSettings();
    let unlistenFn: (() => void) | undefined;
    async function initDownloads() {
      unlistenFn = await listenToProgress();
      fetchDownloadedEpisodes();
    }
    initDownloads();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [loadInitialData, initSettings, listenToProgress, fetchDownloadedEpisodes]);

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
        onBack={async () => {
          await closePlayer();
          if (selectedRelease) {
            setActiveScreen("details");
          } else {
            setActiveScreen("home");
          }
        }}
        onGoToRelease={async () => {
          setSelectedRelease(currentRelease);
          setActiveScreen("details");
          await closePlayer();
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

        {activeScreen === "downloads" && <DownloadsView />}

        {activeScreen === "details" && selectedRelease && (
          <ReleaseDetails
            release={selectedRelease}
            onBack={() => setActiveScreen(previousScreen)}
          />
        )}
      </main>

      {/* Settings Dialog */}
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Floating Download Widget */}
      <DownloadFloatingWidget />
    </div>
  );
}
