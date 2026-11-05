import { Suspense, useEffect, useState } from "react";
import { BookmarksView } from "@/features/bookmarks";
import {
  CatalogHero,
  GenreSelector,
  GenreView,
  ReleaseSchedule,
  ReleasesGrid,
  ReleasesRail,
  useCatalogStore,
} from "@/features/catalog";
import { ContinueWatching } from "@/features/continue-watching";
import { DownloadFloatingWidget, DownloadsView, useDownloadStore } from "@/features/downloads";
import { LazyPlayerOverlay, usePlayerStore } from "@/features/player";
import { ReleaseDetails } from "@/features/release";
import { SettingsDialog } from "@/features/settings";
import { useViewTransition } from "@/shared/lib/useViewTransition";
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
    searchQuery,
    selectedGenre,
    selectGenre,
    loadInitialData,
  } = useCatalogStore();

  const { isPlayerOpen, closePlayer, currentRelease, currentEpisode, initSettings } =
    usePlayerStore();

  const { listenToProgress, fetchDownloadedEpisodes } = useDownloadStore();

  const [previousScreen, setPreviousScreen] = useState<
    "home" | "bookmarks" | "genre" | "downloads"
  >("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const startViewTransition = useViewTransition();

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

  const handleSelectRelease = (release: Release) => {
    const fromScreen = activeScreen !== "details" ? activeScreen : null;
    startViewTransition(() => {
      if (fromScreen) setPreviousScreen(fromScreen);
      void selectReleaseWithDetails(release);
    });
  };

  const handleBackToCatalog = () => {
    startViewTransition(() => setActiveScreen(previousScreen));
  };

  const featured = latestReleases[0] ?? null;
  const isSearching = searchQuery.trim().length > 0;

  if (isPlayerOpen && currentRelease && currentEpisode) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-full flex-col bg-ground text-ink font-sans selection:bg-accent selection:text-ink overflow-hidden">
            <Header onOpenSettings={() => setIsSettingsOpen(true)} />
            <div className="flex flex-1 items-center justify-center text-ink-2">
              Загрузка плеера…
            </div>
          </div>
        }
      >
        <LazyPlayerOverlay
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
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-ground text-ink font-sans selection:bg-accent selection:text-ink overflow-hidden">
      {/* Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeScreen === "home" &&
          (isSearching ? (
            <ReleasesGrid onSelectRelease={handleSelectRelease} />
          ) : (
            <>
              {featured && (
                <CatalogHero release={featured} onOpen={() => handleSelectRelease(featured)} />
              )}
              <div className="py-8">
                <ContinueWatching />
                <ReleasesRail
                  title="Новые релизы"
                  releases={latestReleases}
                  onSelectRelease={handleSelectRelease}
                />
                {latestReleases.length > 0 && (
                  <div className="px-12 pt-8">
                    <ReleaseSchedule
                      releases={latestReleases}
                      onSelectRelease={handleSelectRelease}
                    />
                  </div>
                )}
                <div className="px-12 pb-16 pt-8">
                  <GenreSelector selectedGenre={selectedGenre} onSelectGenre={selectGenre} />
                </div>
              </div>
            </>
          ))}

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
          <ReleaseDetails release={selectedRelease} onBack={handleBackToCatalog} />
        )}
      </main>

      {/* Settings Dialog */}
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Floating Download Widget */}
      <DownloadFloatingWidget />
    </div>
  );
}
