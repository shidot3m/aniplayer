import { CheckCircle2, Download } from "lucide-react";
import type { EpisodeItem, HistoryItem } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { EpisodeCard } from "./EpisodeCard";

interface EpisodesTabContentProps {
  episodes?: EpisodeItem[];
  releaseId: number;
  fallbackPoster?: string;
  history: HistoryItem[];
  downloadingEpIds: Record<string, boolean>;
  isDownloadingAll: boolean;
  onPlay: (ep: EpisodeItem) => void;
  onToggleWatched: (episodeId: string, ordinal: number, completed: boolean) => void;
  onDownload: (ep: EpisodeItem) => void;
  onDownloadAll: () => void;
}

export function EpisodesTabContent({
  episodes,
  releaseId,
  fallbackPoster,
  history,
  downloadingEpIds,
  isDownloadingAll,
  onPlay,
  onToggleWatched,
  onDownload,
  onDownloadAll,
}: EpisodesTabContentProps) {
  if (!episodes || episodes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line bg-surface-1/50 text-xs text-ink-2">
        Список эпизодов пуст или еще загружается
      </div>
    );
  }

  const watchedCount = episodes.filter((episode) =>
    history.some(
      (item) =>
        item.release_id === releaseId && item.episode_id === episode.id && item.is_completed,
    ),
  ).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-2">
          <span>Всего эпизодов: {episodes.length}</span>
          {watchedCount > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-ink font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Просмотрено: {watchedCount} из {episodes.length}
                </span>
              </span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDownloadingAll}
          onClick={onDownloadAll}
          className="gap-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isDownloadingAll ? "Загрузка..." : "Скачать все"}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {episodes.map((episode) => {
          const episodeHistory = history.find(
            (item) => item.release_id === releaseId && item.episode_id === episode.id,
          );
          return (
            <EpisodeCard
              key={episode.id}
              ep={episode}
              fallbackPoster={fallbackPoster}
              isWatched={!!episodeHistory?.is_completed}
              isDownloading={!!downloadingEpIds[episode.id]}
              onPlay={() => onPlay(episode)}
              onToggleWatched={() =>
                onToggleWatched(episode.id, episode.ordinal, !episodeHistory?.is_completed)
              }
              onDownload={() => onDownload(episode)}
            />
          );
        })}
      </div>
    </div>
  );
}
