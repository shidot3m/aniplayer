import type { EpisodeItem, HistoryItem } from "@/shared/types";
import { SectionHead } from "@/shared/ui/section-head";
import { EpisodeCard } from "./EpisodeCard";

interface EpisodesTabContentProps {
  episodes?: EpisodeItem[];
  releaseId: number;
  fallbackPoster?: string;
  history: HistoryItem[];
  currentEpisodeId?: string | null;
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
  currentEpisodeId,
  downloadingEpIds,
  isDownloadingAll,
  onPlay,
  onToggleWatched,
  onDownload,
  onDownloadAll,
}: EpisodesTabContentProps) {
  if (!episodes || episodes.length === 0) {
    return (
      <p className="px-12 py-10 text-sm text-ink-2">Список эпизодов пуст или ещё загружается</p>
    );
  }

  const sorted = [...episodes].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <div className="px-12">
      <SectionHead
        title="Эпизоды"
        trailing={episodes.length}
        className="px-0"
        action={
          <button
            type="button"
            disabled={isDownloadingAll}
            onClick={onDownloadAll}
            className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-50"
          >
            {isDownloadingAll ? "Загрузка…" : "Скачать все"}
          </button>
        }
      />

      <div className="mt-2">
        {sorted.map((episode) => {
          const episodeHistory = history.find(
            (item) => item.release_id === releaseId && item.episode_id === episode.id,
          );
          return (
            <EpisodeCard
              key={episode.id}
              ep={episode}
              fallbackPoster={fallbackPoster}
              isWatched={!!episodeHistory?.is_completed}
              isCurrent={episode.id === currentEpisodeId}
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
