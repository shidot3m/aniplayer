import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FolderDown,
  Loader2,
  X,
} from "lucide-react";
import { formatBytes } from "../lib/utils";
import { useCatalogStore } from "../store/catalogStore";
import { useDownloadStore } from "../store/downloadStore";
import type { DownloadProgressEvent } from "../types";
import { Badge } from "./ui/badge";

function DownloadItemRow({
  item,
  onDismiss,
}: {
  item: DownloadProgressEvent;
  onDismiss: (id: string) => void;
}) {
  const isCompleted = item.status === "COMPLETED";
  const isFailed = item.status === "FAILED";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-rose-400 animate-spin shrink-0" />
          )}
          <span className="text-xs font-semibold text-white truncate">
            Эпизод {item.episodeOrdinal}
          </span>
          <span className="text-[10px] text-slate-400">#{item.releaseId}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-rose-400">{Math.round(item.percent)}%</span>
          <button
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => onDismiss(item.episodeId)}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mb-1.5">
        <div
          className={`h-full transition-all duration-200 rounded-full ${
            isCompleted ? "bg-emerald-500" : isFailed ? "bg-rose-500" : "bg-rose-600"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>
          {item.totalSegments > 0
            ? `${item.downloadedSegments} / ${item.totalSegments} сегментов`
            : "Инициализация..."}
        </span>
        <span>{formatBytes(item.totalBytes)}</span>
      </div>
      {item.error && <div className="mt-1 text-[10px] text-rose-400 truncate">{item.error}</div>}
    </div>
  );
}

export function DownloadFloatingWidget() {
  const { setActiveScreen } = useCatalogStore();
  const {
    activeDownloads,
    isWidgetExpanded,
    isWidgetVisible,
    toggleWidgetExpanded,
    setWidgetVisible,
    dismissDownload,
    clearCompletedDownloads,
  } = useDownloadStore();

  const items = Object.values(activeDownloads);
  if (!isWidgetVisible || items.length === 0) {
    return null;
  }

  const activeCount = items.filter((i) => i.status === "DOWNLOADING").length;
  const avgPercent = Math.round(
    items.reduce((acc, curr) => acc + curr.percent, 0) / Math.max(1, items.length),
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto select-none">
      {isWidgetExpanded ? (
        <div className="w-80 md:w-96 rounded-2xl border border-white/15 bg-[#12131A]/95 p-3.5 shadow-2xl backdrop-blur-2xl transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-bold text-white">Загрузка эпизодов</span>
              <Badge variant="rose" className="h-4 px-1.5 text-[9px]">
                {items.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Свернуть виджет"
                onClick={toggleWidgetExpanded}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Закрыть виджет"
                onClick={() => setWidgetVisible(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {items.map((item) => (
              <DownloadItemRow key={item.episodeId} item={item} onDismiss={dismissDownload} />
            ))}
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveScreen("downloads");
                toggleWidgetExpanded();
              }}
              className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer transition-colors"
            >
              <FolderDown className="h-3.5 w-3.5" />
              <span>Все скачанные</span>
            </button>

            {items.some((i) => i.status !== "DOWNLOADING") && (
              <button
                type="button"
                onClick={clearCompletedDownloads}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                Очистить завершённые
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleWidgetExpanded}
          className="flex items-center gap-2.5 rounded-full border border-rose-500/40 bg-[#12131A]/95 px-4 py-2.5 shadow-2xl backdrop-blur-2xl hover:border-rose-500 hover:bg-[#161824] transition-all cursor-pointer group"
        >
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 text-rose-500 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <span className="text-xs font-semibold text-white">
            {activeCount > 0 ? `Качается: ${activeCount}` : "Загрузки завершены"}
          </span>
          <span className="text-xs font-bold text-rose-400">{avgPercent}%</span>
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-colors" />
        </button>
      )}
    </div>
  );
}
