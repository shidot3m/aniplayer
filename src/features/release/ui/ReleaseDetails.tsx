import { ChevronLeft } from "lucide-react";
import { useCatalogStore } from "@/features/catalog";
import { usePlayerStore } from "@/features/player";
import { findBookmarkCategory, formatPosterUrl } from "@/shared/lib/releaseUtils";
import type { EpisodeItem, Release } from "@/shared/types";
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
    history,
    setBookmark,
    removeBookmark,
    setEpisodeWatched,
    selectReleaseWithDetails,
  } = useCatalogStore();
  const { playEpisode } = usePlayerStore();
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

  return (
    <div className="text-ink">
      <div className="px-12 pt-6 pb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-ink-2 transition-colors hover:text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Назад</span>
        </button>
      </div>

      <ReleaseHero
        release={release}
        currentCategory={currentCategory}
        startEpisode={startEpisode}
        playButtonText={playButtonText}
        onPlay={handlePlay}
        onBookmarkChange={(category) => setBookmark(release.id, category, release)}
        onRemoveBookmark={() => removeBookmark(release.id)}
      />

      <div className="py-8">
        <EpisodesTabContent
          episodes={release.episodes}
          releaseId={release.id}
          fallbackPoster={fallbackPoster}
          history={history}
          currentEpisodeId={startEpisode?.id ?? null}
          downloadingEpIds={downloadingEpIds}
          isDownloadingAll={isDownloadingAll}
          onPlay={handlePlay}
          onToggleWatched={(episodeId, ordinal, completed) =>
            setEpisodeWatched(release.id, episodeId, ordinal, completed)
          }
          onDownload={handleDownload}
          onDownloadAll={handleDownloadAll}
        />

        <RelatedTab
          isLoading={isLoadingFranchises}
          franchises={franchises}
          currentReleaseId={release.id}
          onSelectRelease={selectReleaseWithDetails}
        />
      </div>
    </div>
  );
}
