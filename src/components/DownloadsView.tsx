import { convertFileSrc } from "@tauri-apps/api/core";
import { CheckCircle2, Film, FolderDown, FolderOpen, HardDrive, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CDN_BASE_URL } from "../shared/lib/constants";
import { formatBytes } from "../shared/lib/utils";
import type { DownloadedEpisodeMeta, EpisodeItem, Release } from "../shared/types";
import { Badge } from "../shared/ui/badge";
import { Button } from "../shared/ui/button";
import { useCatalogStore } from "../store/catalogStore";
import { useDownloadStore } from "../store/downloadStore";
import { usePlayerStore } from "../store/playerStore";

function formatPosterUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http") || rawUrl.startsWith("data:")) return rawUrl;
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${CDN_BASE_URL}${cleanPath}`;
}

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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          aria-label={`Смотреть эпизод ${meta.episode_ordinal}`}
          onClick={() => isCompleted && onPlay(meta, release)}
          disabled={!isCompleted}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
            isCompleted
              ? "border-rose-500/40 bg-rose-600/20 text-rose-400 hover:scale-105 hover:bg-rose-600 hover:text-white cursor-pointer"
              : "border-white/10 bg-white/5 text-slate-500 cursor-not-allowed"
          }`}
        >
          <Play className="h-4 w-4 fill-current ml-0.5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              Эпизод {meta.episode_ordinal}
            </span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
              {meta.quality || "1080p"}
            </Badge>
            {isWatched && (
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 text-[10px] py-0 px-1.5 h-4 flex items-center gap-1"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                <span>Просмотрен</span>
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
            <span>Размер: {formatBytes(meta.file_size)}</span>
            {meta.opening_start != null && meta.opening_stop != null && (
              <span>• Таймкоды сохранены</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          aria-label="Удалить файл эпизода"
          onClick={() => onDelete(meta.episode_id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Удалить эпизод с диска"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
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
    <div className="rounded-2xl border border-white/10 bg-[#12131A] p-5 shadow-xl transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-black/40 border border-white/10">
            {poster ? (
              <img src={poster} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                N/A
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{title}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Film className="h-3.5 w-3.5 text-rose-400" />
                {items.length} эп.
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                {formatBytes(totalSize)}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenFolder(releaseId)}
          className="gap-1.5 text-xs border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Папка аниме</span>
        </Button>
      </div>

      <div className="mt-3.5 space-y-2">
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
    const releaseEpisodesMeta = groupedByRelease.get(meta.release_id) || [meta];

    // Build EpisodeItems for all downloaded episodes of this release for offline playlist support
    const offlineEpisodes: EpisodeItem[] = releaseEpisodesMeta
      .slice()
      .sort((a, b) => a.episode_ordinal - b.episode_ordinal)
      .map((m) => {
        let stream = m.file_path;
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          try {
            stream = convertFileSrc(m.file_path);
          } catch (_e) {
            stream = m.file_path;
          }
        }
        return {
          id: m.episode_id,
          ordinal: m.episode_ordinal,
          duration: 1440,
          hls_1080: stream,
          hls_720: stream,
          hls_480: stream,
          opening: {
            start: m.opening_start,
            stop: m.opening_stop,
          },
          ending: {
            start: m.ending_start,
            stop: m.ending_stop,
          },
        };
      });

    const currentEpisode =
      offlineEpisodes.find((e) => e.id === meta.episode_id) || offlineEpisodes[0];

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
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FolderDown className="h-6 w-6 text-rose-500" />
            <span>Скачанные аниме</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Офлайн-библиотека • {downloadedEpisodes.length} серий • {formatBytes(totalSize)} на
            диске
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDownloadsFolder()}
            className="gap-2 border-white/10 hover:border-white/20 text-slate-300 hover:text-white"
          >
            <FolderOpen className="h-4 w-4 text-rose-400" />
            <span>Открыть папку загрузок</span>
          </Button>
        </div>
      </div>

      {/* Content / Groups */}
      {groupedByRelease.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-slate-500 mb-4">
            <FolderDown className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Нет скачанных серий</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            Вы можете скачивать серии для просмотра без подключения к интернету на странице аниме.
          </p>
          <Button onClick={() => setActiveScreen("home")} className="gap-2">
            <span>Перейти в каталог</span>
          </Button>
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
