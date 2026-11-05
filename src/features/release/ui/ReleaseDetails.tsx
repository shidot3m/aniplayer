import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useCatalogStore } from "@/features/catalog";
import { usePlayerStore } from "@/features/player";
import { findBookmarkCategory, formatPosterUrl, isReleaseWatched } from "@/shared/lib/releaseUtils";
import type { EpisodeItem, Release } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useFranchises } from "../hooks/useFranchises";
import { useReleaseDownloader } from "../hooks/useReleaseDownloader";
import { useStartEpisode } from "../hooks/useStartEpisode";
import { EpisodesTabContent } from "./EpisodesTabContent";
import { RelatedTab } from "./RelatedTab";
import { ReleaseHero } from "./ReleaseHero";

interface ReleaseDetailsProps {
  release: Release;
  onBack: () => void;
}

export function ReleaseDetails({ release, onBack }: ReleaseDetailsProps) {
  const {
    bookmarks,
    setBookmark,
    removeBookmark,
    history,
    setEpisodeWatched,
    selectReleaseWithDetails,
  } = useCatalogStore();
  const { playEpisode } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<string>("episodes");
  const { downloadingEpIds, isDownloadingAll, handleDownload, handleDownloadAll } =
    useReleaseDownloader(release);
  const { franchises, isLoading: isLoadingFranchises } = useFranchises(release.id);
  const { startEpisode, playButtonText } = useStartEpisode(release.id, release.episodes, history);

  const handlePlay = (episode: EpisodeItem) => {
    const entry = history.find(
      (item) => item.release_id === release.id && item.episode_id === episode.id,
    );
    const startPos = entry && !entry.is_completed ? entry.last_position : 0;
    playEpisode(release, episode, startPos);
  };

  const fallbackPoster = formatPosterUrl(
    release.poster?.preview || release.poster?.src || release.poster?.thumbnail,
  );
  const currentCategory = findBookmarkCategory(bookmarks, release.id);
  const isWatched = isReleaseWatched(release, history, currentCategory);
  const totalRelatedCount = franchises.reduce(
    (acc, franchise) => acc + (franchise.franchise_releases?.length || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 text-ink">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад в каталог</span>
        </Button>
      </div>

      <ReleaseHero
        release={release}
        isWatched={isWatched}
        currentCategory={currentCategory}
        startEpisode={startEpisode}
        playButtonText={playButtonText}
        onPlay={handlePlay}
        onBookmarkChange={(category) => setBookmark(release.id, category, release)}
        onRemoveBookmark={() => removeBookmark(release.id)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="episodes" className="px-5">
            Эпизоды ({release.episodes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="related" className="px-5">
            Связанное {totalRelatedCount > 0 ? `(${totalRelatedCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="episodes">
          <EpisodesTabContent
            episodes={release.episodes}
            releaseId={release.id}
            fallbackPoster={fallbackPoster}
            history={history}
            downloadingEpIds={downloadingEpIds}
            isDownloadingAll={isDownloadingAll}
            onPlay={handlePlay}
            onToggleWatched={(episodeId, ordinal, completed) =>
              setEpisodeWatched(release.id, episodeId, ordinal, completed)
            }
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
          />
        </TabsContent>

        <TabsContent value="related">
          <RelatedTab
            isLoading={isLoadingFranchises}
            franchises={franchises}
            currentReleaseId={release.id}
            onSelectRelease={selectReleaseWithDetails}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
