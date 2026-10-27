import type { EpisodeItem, HistoryItem, Release } from "../../shared/types";

export interface ContinueWatchingCardItem {
  releaseId: number;
  release: Release | null;
  targetEpisode: EpisodeItem | null;
  episodeOrdinal: number;
  isCompleted: boolean;
  isNextEpisode: boolean;
  lastPosition: number;
  duration: number;
  progressPercent: number;
  updatedAt: string;
}

export function buildContinueWatchingItems(
  releaseHistoryMap: Map<number, HistoryItem[]>,
  cachedReleases: Record<number, Release>,
  latestReleases: Release[],
): ContinueWatchingCardItem[] {
  const result: ContinueWatchingCardItem[] = [];

  for (const [releaseId, items] of releaseHistoryMap.entries()) {
    const release =
      cachedReleases[releaseId] || latestReleases.find((item) => item.id === releaseId) || null;
    const sortedEpisodes = [...(release?.episodes || [])].sort((a, b) => a.ordinal - b.ordinal);
    const completedEpisodeIds = new Set(
      items.filter((item) => item.is_completed).map((item) => item.episode_id),
    );

    const inProgress = items.find((item) => !item.is_completed && item.last_position > 0);
    if (inProgress) {
      const episode =
        sortedEpisodes.find(
          (item) =>
            item.id === inProgress.episode_id || item.ordinal === inProgress.episode_ordinal,
        ) || null;
      const duration = inProgress.duration || (episode ? 1440 : 0);
      const position = inProgress.last_position;
      result.push({
        releaseId,
        release,
        targetEpisode: episode,
        episodeOrdinal: inProgress.episode_ordinal,
        isCompleted: false,
        isNextEpisode: false,
        lastPosition: position,
        duration,
        progressPercent: duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0,
        updatedAt: inProgress.updated_at || "",
      });
      continue;
    }

    const lastCompleted = items.find((item) => item.is_completed);
    if (!lastCompleted) continue;

    const nextEpisode =
      sortedEpisodes.find(
        (item) => item.ordinal > lastCompleted.episode_ordinal && !completedEpisodeIds.has(item.id),
      ) || sortedEpisodes.find((item) => !completedEpisodeIds.has(item.id));

    if (nextEpisode) {
      result.push({
        releaseId,
        release,
        targetEpisode: nextEpisode,
        episodeOrdinal: nextEpisode.ordinal,
        isCompleted: false,
        isNextEpisode: true,
        lastPosition: 0,
        duration: 1440,
        progressPercent: 0,
        updatedAt: lastCompleted.updated_at || "",
      });
    }
  }

  return result.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime() || 0;
    const dateB = new Date(b.updatedAt).getTime() || 0;
    return dateB - dateA;
  });
}
