import { useMemo } from "react";
import type { EpisodeItem, HistoryItem } from "../types";

interface StartEpisodeInfo {
  startEpisode: EpisodeItem | null;
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

    const inProgress = releaseHistory.find((item) => !item.is_completed && item.last_position > 0);
    if (inProgress) {
      const episode = sortedEpisodes.find((item) => item.id === inProgress.episode_id);
      if (episode) {
        return {
          startEpisode: episode,
          playButtonText: `Продолжить с ${episode.ordinal} эпизода`,
        };
      }
    }

    const lastWatched = releaseHistory[0];
    if (lastWatched) {
      if (lastWatched.is_completed) {
        const nextUnwatched = sortedEpisodes.find(
          (item) => item.ordinal > lastWatched.episode_ordinal && !completedEpisodeIds.has(item.id),
        );
        if (nextUnwatched) {
          return {
            startEpisode: nextUnwatched,
            playButtonText: `Продолжить с ${nextUnwatched.ordinal} эпизода`,
          };
        }
        const anyUnwatched = sortedEpisodes.find((item) => !completedEpisodeIds.has(item.id));
        if (anyUnwatched) {
          return {
            startEpisode: anyUnwatched,
            playButtonText: `Продолжить с ${anyUnwatched.ordinal} эпизода`,
          };
        }
        return {
          startEpisode: sortedEpisodes[0],
          playButtonText: "Пересмотреть с 1 эпизода",
        };
      }

      const episode =
        sortedEpisodes.find((item) => item.id === lastWatched.episode_id) || sortedEpisodes[0];
      return {
        startEpisode: episode,
        playButtonText: `Продолжить с ${episode.ordinal} эпизода`,
      };
    }

    return {
      startEpisode: sortedEpisodes[0],
      playButtonText: "Смотреть с 1 эпизода",
    };
  }, [episodes, history, releaseId]);
}
