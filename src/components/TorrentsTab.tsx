import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, FileDown, HardDrive, Loader2, Magnet, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../lib/constants";
import { formatBytes } from "../lib/utils";
import type { TorrentItem } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface TorrentsTabProps {
  releaseId: number;
}

function isHevcTorrent(t: TorrentItem): boolean {
  const val = t.codec?.value?.toLowerCase() || "";
  const lbl = t.codec?.label?.toLowerCase() || "";
  const labelText = t.label?.toLowerCase() || "";
  return (
    val.includes("hevc") ||
    val.includes("x265") ||
    lbl.includes("hevc") ||
    labelText.includes("hevc")
  );
}

async function fetchReleaseTorrents(releaseId: number): Promise<TorrentItem[]> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      return await invoke<TorrentItem[]>("api_get_release_torrents", {
        releaseId,
      });
    } catch (_err) {
      // Fallback to fetch
    }
  }
  const res = await fetch(`${API_BASE_URL}/anime/torrents/release/${releaseId}`);
  if (!res.ok) return [];
  return (await res.json()) || [];
}

interface TorrentCardProps {
  torrent: TorrentItem;
  isDownloading: boolean;
  isCopied: boolean;
  onOpenMagnet: (torrent: TorrentItem) => void;
  onDownloadFile: (torrent: TorrentItem) => void;
  onCopyMagnet: (torrent: TorrentItem) => void;
}

function TorrentCard({
  torrent,
  isDownloading,
  isCopied,
  onOpenMagnet,
  onDownloadFile,
  onCopyMagnet,
}: TorrentCardProps) {
  const isHevc = isHevcTorrent(torrent);

  return (
    <div
      className={`rounded-xl border p-4 backdrop-blur-md transition-all ${
        isHevc
          ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {isHevc && (
              <Badge className="bg-emerald-600/90 text-white font-bold text-[10px] px-2 py-0.5">
                HEVC (x265)
              </Badge>
            )}
            {torrent.quality?.value && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                {torrent.quality.value}
              </Badge>
            )}
            {torrent.size ? (
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                {formatBytes(torrent.size)}
              </span>
            ) : null}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-emerald-400 font-semibold">{torrent.seeders ?? 0}</span>
              <span>/</span>
              <span className="text-rose-400 font-semibold">{torrent.leechers ?? 0}</span>
            </span>
          </div>

          <h4 className="text-xs md:text-sm font-semibold text-white break-words">
            {torrent.label || torrent.filename || `Раздача #${torrent.id}`}
          </h4>
          {torrent.description && (
            <p className="mt-1 text-xs text-slate-400">Серии: {torrent.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => onOpenMagnet(torrent)}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            <Magnet className="h-3.5 w-3.5" />
            <span>Магнет</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading}
            onClick={() => onDownloadFile(torrent)}
            className="gap-1.5 text-xs border-white/15 text-slate-200 hover:text-white cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-sky-400" />
            )}
            <span>{isDownloading ? "Загрузка..." : ".torrent"}</span>
          </Button>

          <button
            type="button"
            aria-label="Копировать магнет-ссылку"
            title="Копировать магнет-ссылку в буфер"
            onClick={() => onCopyMagnet(torrent)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function useReleaseTorrents(releaseId: number) {
  const [data, setData] = useState<{
    id: number;
    items: TorrentItem[];
    loading: boolean;
  }>({
    id: releaseId,
    items: [],
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;
    fetchReleaseTorrents(releaseId)
      .then((items) => {
        if (isMounted) {
          setData({ id: releaseId, items, loading: false });
        }
      })
      .catch((err) => {
        console.error("Failed to load torrents:", err);
        if (isMounted) {
          setData({ id: releaseId, items: [], loading: false });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [releaseId]);

  const isLoading = data.loading || data.id !== releaseId;
  const torrents = data.id === releaseId ? data.items : [];

  return { torrents, isLoading };
}

export function TorrentsTab({ releaseId }: TorrentsTabProps) {
  const { torrents, isLoading } = useReleaseTorrents(releaseId);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [onlyHevc, setOnlyHevc] = useState(false);

  const hasHevc = useMemo(() => torrents.some(isHevcTorrent), [torrents]);

  const displayedTorrents = useMemo(() => {
    if (onlyHevc) {
      return torrents.filter(isHevcTorrent);
    }
    return torrents;
  }, [torrents, onlyHevc]);

  const handleOpenMagnet = async (torrent: TorrentItem) => {
    if (!torrent.magnet) {
      alert("Магнет-ссылка недоступна для этой раздачи");
      return;
    }
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await invoke("downloader_open_magnet", { magnet: torrent.magnet });
      } else {
        window.open(torrent.magnet, "_blank");
      }
    } catch (err) {
      console.error("Failed to open magnet:", err);
      alert(`Не удалось открыть торрент-клиент: ${err}`);
    }
  };

  const handleDownloadTorrentFile = async (torrent: TorrentItem) => {
    try {
      setDownloadingId(torrent.id);
      const filename = torrent.filename || `release_${releaseId}_${torrent.id}.torrent`;
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        const path = await invoke<string>("downloader_download_torrent", {
          torrentId: torrent.id,
          filename,
          autoOpen: true,
        });
        alert(`Файл .torrent сохранён и передан в торрент-клиент:\n${path}`);
      } else {
        window.open(`${API_BASE_URL}/anime/torrents/${torrent.id}/file`, "_blank");
      }
    } catch (err) {
      console.error("Failed to download torrent file:", err);
      alert(`Ошибка скачивания .torrent: ${err}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyMagnet = (torrent: TorrentItem) => {
    if (!torrent.magnet) return;
    navigator.clipboard.writeText(torrent.magnet);
    setCopiedId(torrent.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
        <p className="text-xs text-slate-400">Загрузка торрент-раздач (HEVC / Full HD)...</p>
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#12131A]/40 p-6 text-center text-slate-400">
        <HardDrive className="mb-2 h-10 w-10 text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-300">Торрент-раздачи не найдены</h4>
        <p className="mt-1 text-xs text-slate-500">
          Для этого тайтла ещё не опубликованы торрент-раздачи
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">
            Доступно раздач: {torrents.length}
          </span>
          {hasHevc && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-950/30 text-emerald-400 text-[10px]"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              HEVC доступен
            </Badge>
          )}
        </div>

        {hasHevc && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyHevc(!onlyHevc)}
              className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                onlyHevc
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              Только HEVC (x265)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {displayedTorrents.map((t) => (
          <TorrentCard
            key={t.id}
            torrent={t}
            isDownloading={downloadingId === t.id}
            isCopied={copiedId === t.id}
            onOpenMagnet={handleOpenMagnet}
            onDownloadFile={handleDownloadTorrentFile}
            onCopyMagnet={handleCopyMagnet}
          />
        ))}
      </div>
    </div>
  );
}
