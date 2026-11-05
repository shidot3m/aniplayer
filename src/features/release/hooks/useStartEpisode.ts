import { useMemo } from "react";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem, HistoryItem } from "@/shared/types";

interface StartEpisodeInfo {
  startEpisode: EpisodeItem | null;
  /** Hero action label. A saved position is read as a timecode; a fresh start names the Ordinal. */
  playButtonText: string;
}

export function useStartEpisode(
  releaseId: number,
  episodes: EpisodeItem[] | undefined,
  history: HistoryItem[],
): StartEpisodeInfo {
  return useMemo(() => {
    const sortedEpisodes = [...(episodes || [])].sort((a, b) => a.ordinal - b.ordinal);
    if (sortedEpisodes.length === 0) {
      return { startEpisode: null, playButtonText: "Эпизоды недоступны" };
    }

    const releaseHistory = history.filter((item) => item.release_id === releaseId);
    const completedEpisodeIds = new Set(
      releaseHistory.filter((item) => item.is_completed).map((item) => item.episode_id),
    );

    // The signature detail: resuming an Episode in progress reads its position as a timecode.
    const resume = (episode: EpisodeItem, position: number): StartEpisodeInfo =>
      position > 0
        ? { startEpisode: episode, playButtonText: `Смотреть с ${formatTime(position)}` }
        : { startEpisode: episode, playButtonText: `Смотреть с ${episode.ordinal} эпизода` };

    const inProgress = releaseHistory.find((item) => !item.is_completed && item.last_position > 0);
    if (inProgress) {
      const episode = sortedEpisodes.find((item) => item.id === inProgress.episode_id);
      if (episode) return resume(episode, inProgress.last_position);
    }

    const lastWatched = releaseHistory[0];
    if (lastWatched) {
      if (lastWatched.is_completed) {
        const nextUnwatched = sortedEpisodes.find(
          (item) => item.ordinal > lastWatched.episode_ordinal && !completedEpisodeIds.has(item.id),
        );
        if (nextUnwatched) return resume(nextUnwatched, 0);

        const anyUnwatched = sortedEpisodes.find((item) => !completedEpisodeIds.has(item.id));
        if (anyUnwatched) return resume(anyUnwatched, 0);

        return {
          startEpisode: sortedEpisodes[0],
          playButtonText: `Смотреть с 1 эпизода`,
        };
      }

      const episode =
        sortedEpisodes.find((item) => item.id === lastWatched.episode_id) || sortedEpisodes[0];
      return resume(episode, lastWatched.last_position);
    }

    return { startEpisode: sortedEpisodes[0], playButtonText: "Смотреть с 1 эпизода" };
  }, [episodes, history, releaseId]);
}
