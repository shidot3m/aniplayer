import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import type { EpisodeItem, Release } from "@/shared/types";

export function useReleaseDownloader(release: Release) {
  const [downloadingEpIds, setDownloadingEpIds] = useState<Record<string, boolean>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownload = async (ep: EpisodeItem) => {
    try {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: true }));
      const hlsUrl = ep.hls_1080 || ep.hls_720 || ep.hls_480;
      if (!hlsUrl) {
        alert("Поток для скачивания не найден");
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
      alert(`Загрузка эпизода ${ep.ordinal} начата. Опенинг и эндинг сохранены.`);
    } catch (err) {
      console.error("Failed to start download:", err);
      alert(`Ошибка: ${err}`);
    } finally {
      setDownloadingEpIds((prev) => ({ ...prev, [ep.id]: false }));
    }
  };

  const handleDownloadAll = async () => {
    const eps = release.episodes || [];
    const downloadable = eps.filter((ep) => ep.hls_1080 || ep.hls_720 || ep.hls_480);
    if (downloadable.length === 0) {
      alert("Нет доступных видеопотоков для скачивания этого тайтла");
      return;
    }

    try {
      setIsDownloadingAll(true);
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

      await invoke("downloader_start_release", {
        releaseId: release.id,
        episodes: payload,
      });

      alert(
        `Загрузка всех эпизодов (${payload.length} шт.) начата в фоновом режиме. Файлы сохраняются в папку downloads.`,
      );
    } catch (err) {
      console.error("Failed to start batch download:", err);
      alert(`Ошибка при запуске загрузки: ${err}`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return { downloadingEpIds, isDownloadingAll, handleDownload, handleDownloadAll };
}
