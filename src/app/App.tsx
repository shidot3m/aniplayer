import { useEffect, useState } from "react";
import { BookmarksView } from "@/features/bookmarks";
import {
  GenreSelector,
  GenreView,
  ReleaseSchedule,
  ReleasesGrid,
  useCatalogStore,
} from "@/features/catalog";
import { ContinueWatching } from "@/features/continue-watching";
import { DownloadFloatingWidget, DownloadsView, useDownloadStore } from "@/features/downloads";
import { PlayerOverlay, usePlayerStore } from "@/features/player";
import { ReleaseDetails } from "@/features/release";
import { SettingsDialog } from "@/features/settings";
import type { Release } from "@/shared/types";
import { Header } from "./Header";

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

            <ReleasesGrid
              searchQuery={searchQuery}
              isSearching={isSearching}
              releases={displayedReleases}
              onSelectRelease={handleSelectRelease}
            />

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
