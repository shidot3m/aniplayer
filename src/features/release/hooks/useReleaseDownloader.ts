import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useDownloadStore } from "@/features/downloads";
import type { EpisodeItem, Release } from "@/shared/types";

/**
 * A failure line for the downloads widget. The backend emits `download-progress` only for a task
 * it accepted, so a stream that could not be found, or a start call that failed, would otherwise
 * leave the user with no feedback — issue #77 retired the native `alert` that used to cover this.
 */
function failureNotice(
  release: Release,
  episodeId: string,
  episodeOrdinal: number,
  message: string,
) {
  return { episodeId, releaseId: release.id, episodeOrdinal, message };
}

export function useReleaseDownloader(release: Release) {
  const [downloadingEpIds, setDownloadingEpIds] = useState<Record<string, boolean>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const notifyFailure = useDownloadStore((s) => s.notifyFailure);

  const handleDownload = async (ep: EpisodeItem) => {
    setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: true }));
    try {
      const hlsUrl = ep.hls_1080 || ep.hls_720 || ep.hls_480;
      if (!hlsUrl) {
        notifyFailure(failureNotice(release, ep.id, ep.ordinal, "Поток для скачивания не найден"));
        return;
      }
      await invoke("downloader_start_episode", {
        releaseId: release.id,
        episode: {
          episodeId: ep.id,
          ordinal: ep.ordinal,
          m3u8Url: hlsUrl,
          quality: "1080p",
          opStart: ep.opening?.start ?? null,
          opStop: ep.opening?.stop ?? null,
          edStart: ep.ending?.start ?? null,
          edStop: ep.ending?.stop ?? null,
        },
      });
      // Success needs no message of its own: the backend starts emitting `download-progress`
      // for the accepted task, and the floating widget shows the running line.
    } catch (err) {
      console.error("Failed to start download:", err);
      notifyFailure(failureNotice(release, ep.id, ep.ordinal, `Ошибка: ${err}`));
    } finally {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: false }));
    }
  };

  const handleDownloadAll = async () => {
    const batchId = `release-${release.id}`;
    const eps = release.episodes || [];
    const downloadable = eps.filter((ep) => ep.hls_1080 || ep.hls_720 || ep.hls_480);
    if (downloadable.length === 0) {
      notifyFailure(
        failureNotice(
          release,
          batchId,
          0,
          "Нет доступных видеопотоков для скачивания этого тайтла",
        ),
      );
      return;
    }

    setIsDownloadingAll(true);
    try {
      const payload = downloadable.map((ep) => ({
        episodeId: ep.id,
        ordinal: ep.ordinal,
        m3u8Url: ep.hls_1080 || ep.hls_720 || ep.hls_480 || "",
        quality: ep.hls_1080 ? "1080p" : ep.hls_720 ? "720p" : "480p",
        opStart: ep.opening?.start ?? null,
        opStop: ep.opening?.stop ?? null,
        edStart: ep.ending?.start ?? null,
        edStop: ep.ending?.stop ?? null,
      }));

      await invoke("downloader_start_release", { releaseId: release.id, episodes: payload });
      // Each queued episode reports through the widget as its `download-progress` events arrive.
    } catch (err) {
      console.error("Failed to start batch download:", err);
      notifyFailure(failureNotice(release, batchId, 0, `Ошибка при запуске загрузки: ${err}`));
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return { downloadingEpIds, isDownloadingAll, handleDownload, handleDownloadAll };
}
