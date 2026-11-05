import { FolderDown, FolderOpen, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCatalogStore } from "@/features/catalog";
import { usePlayerStore } from "@/features/player";
import { formatPosterUrl } from "@/shared/lib/releaseUtils";
import { formatBytes } from "@/shared/lib/utils";
import type { DownloadedEpisodeMeta, EpisodeItem, Release } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { useDownloadStore } from "../state/downloadStore";

function DownloadedEpisodeRow({
  meta,
  release,
  isWatched,
  onPlay,
  onDelete,
}: {
  meta: DownloadedEpisodeMeta;
  release: Release | null;
  isWatched: boolean;
  onPlay: (meta: DownloadedEpisodeMeta, release: Release | null) => void;
  onDelete: (episodeId: string) => void;
}) {
  const isCompleted = meta.download_status === "COMPLETED";

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          aria-label={`Смотреть эпизод ${meta.episode_ordinal}`}
          onClick={() => isCompleted && onPlay(meta, release)}
          disabled={!isCompleted}
          className={
            isCompleted
              ? "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent/60 hover:text-accent-ink"
              : "flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-line text-ink-3"
          }
        >
          <Play className="h-4 w-4 fill-current" />
        </button>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink">
              Эпизод <span className="tabular-nums">{meta.episode_ordinal}</span>
            </span>
            <span className="text-[12px] tabular-nums text-ink-2">{meta.quality || "1080p"}</span>
            {isWatched && <span className="text-[12px] text-ink-3">Просмотрен</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[12px] text-ink-3">
            <span className="tabular-nums">{formatBytes(meta.file_size)}</span>
            {meta.opening_start != null && meta.opening_stop != null && (
              <span>Таймкоды сохранены</span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Удалить файл эпизода"
        onClick={() => onDelete(meta.episode_id)}
        title="Удалить эпизод с диска"
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-ink/5 hover:text-accent-ink"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function DownloadedReleaseCard({
  releaseId,
  items,
  release,
  watchedEpIds,
  onPlay,
  onDelete,
  onOpenFolder,
}: {
  releaseId: number;
  items: DownloadedEpisodeMeta[];
  release: Release | null;
  watchedEpIds: Set<string>;
  onPlay: (meta: DownloadedEpisodeMeta, release: Release | null) => void;
  onDelete: (episodeId: string) => void;
  onOpenFolder: (releaseId: number) => void;
}) {
  const title = release?.name?.main || `Аниме #${releaseId}`;
  const poster = formatPosterUrl(
    release?.poster?.src ||
      release?.poster?.preview ||
      release?.poster?.optimized?.src ||
      release?.poster?.optimized?.preview ||
      release?.poster?.thumbnail,
  );
  const totalSize = items.reduce((acc, curr) => acc + curr.file_size, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {poster ? (
              <img src={poster} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                N/A
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">{title}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
              <span className="tabular-nums">{items.length} эп.</span>
              <span className="tabular-nums">{formatBytes(totalSize)}</span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenFolder(releaseId)}
          className="gap-1.5 text-ink-2 hover:text-ink"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Папка релиза</span>
        </Button>
      </div>

      <div className="mt-1">
        {items.map((epMeta) => (
          <DownloadedEpisodeRow
            key={epMeta.episode_id}
            meta={epMeta}
            release={release}
            isWatched={watchedEpIds.has(epMeta.episode_id)}
            onPlay={onPlay}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function buildOfflineEpisodes(metas: DownloadedEpisodeMeta[]): EpisodeItem[] {
  return metas
    .slice()
    .sort((a, b) => a.episode_ordinal - b.episode_ordinal)
    .map((meta) => {
      return {
        id: meta.episode_id,
        ordinal: meta.episode_ordinal,
        duration: 1440,
        hls_1080: meta.file_path,
        hls_720: meta.file_path,
        hls_480: meta.file_path,
        opening: { start: meta.opening_start, stop: meta.opening_stop },
        ending: { start: meta.ending_start, stop: meta.ending_stop },
      };
    });
}

export function DownloadsView() {
  const { latestReleases, bookmarks, history, setActiveScreen } = useCatalogStore();
  const {
    downloadedEpisodes,
    fetchDownloadedEpisodes,
    deleteDownloadedEpisode,
    openDownloadsFolder,
  } = useDownloadStore();
  const { openPlayer } = usePlayerStore();

  useEffect(() => {
    fetchDownloadedEpisodes();
  }, [fetchDownloadedEpisodes]);

  // Group downloaded episodes by release ID
  const groupedByRelease = useMemo(() => {
    const map = new Map<number, DownloadedEpisodeMeta[]>();
    for (const ep of downloadedEpisodes) {
      const list = map.get(ep.release_id) || [];
      list.push(ep);
      map.set(ep.release_id, list);
    }
    return map;
  }, [downloadedEpisodes]);

  const totalSize = downloadedEpisodes.reduce((acc, curr) => acc + curr.file_size, 0);

  // Cached release finder
  const findRelease = (releaseId: number): Release | null => {
    const inLatest = latestReleases.find((r) => r.id === releaseId);
    if (inLatest) return inLatest;
    for (const list of Object.values(bookmarks)) {
      const inBm = list.find((b) => b.release_id === releaseId);
      if (inBm?.release_data_json) {
        try {
          return JSON.parse(inBm.release_data_json);
        } catch (_e) {
          // ignore
        }
      }
    }
    return null;
  };

  const handlePlayOffline = (meta: DownloadedEpisodeMeta, foundRel: Release | null) => {
    const offlineEpisodes = buildOfflineEpisodes(groupedByRelease.get(meta.release_id) || [meta]);
    const currentEpisode = offlineEpisodes.find((episode) => episode.id === meta.episode_id);
    if (!currentEpisode) return;

    const fallbackRelease: Release = {
      ...(foundRel || {
        id: meta.release_id,
        name: { main: `Аниме #${meta.release_id}` },
      }),
      episodes: offlineEpisodes,
    };

    openPlayer(fallbackRelease, currentEpisode);
  };

  const watchedEpIds = useMemo(
    () => new Set(history.filter((h) => h.is_completed).map((h) => h.episode_id)),
    [history],
  );

  return (
    <div className="px-12 py-8">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Загрузки</h1>
          <p className="mt-1 text-sm text-ink-2">
            <span className="tabular-nums">{downloadedEpisodes.length}</span> серий ·{" "}
            <span className="tabular-nums">{formatBytes(totalSize)}</span> на диске
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => openDownloadsFolder()} className="gap-2">
          <FolderOpen className="h-4 w-4" />
          <span>Открыть папку загрузок</span>
        </Button>
      </div>

      {/* Content / Groups */}
      {groupedByRelease.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderDown className="mb-3 h-10 w-10 text-ink-3" />
          <h3 className="text-base font-semibold text-ink">Нет скачанных серий</h3>
          <p className="mb-6 mt-1 max-w-sm text-sm text-ink-2">
            Скачивайте серии для просмотра без подключения на странице релиза.
          </p>
          <Button onClick={() => setActiveScreen("home")}>Перейти в каталог</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByRelease.entries()).map(([releaseId, items]) => (
            <DownloadedReleaseCard
              key={releaseId}
              releaseId={releaseId}
              items={items}
              release={findRelease(releaseId)}
              watchedEpIds={watchedEpIds}
              onPlay={handlePlayOffline}
              onDelete={deleteDownloadedEpisode}
              onOpenFolder={openDownloadsFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
