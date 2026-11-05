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
import { useCatalogStore } from "@/features/catalog";
import { formatBytes } from "@/shared/lib/utils";
import type { DownloadProgressEvent } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
import { useDownloadStore } from "../state/downloadStore";

function DownloadItemRow({
  item,
  onCancel,
  onDismiss,
}: {
  item: DownloadProgressEvent;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const isCompleted = item.status === "COMPLETED";
  const isFailed = item.status === "FAILED";
  const isDownloading = item.status === "DOWNLOADING";

  return (
    <div className="rounded-xl border border-ink/5 bg-ink/[0.03] p-2.5 transition-colors hover:bg-ink/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-ink shrink-0" />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 text-accent-ink shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-accent-ink animate-spin shrink-0" />
          )}
          <span className="text-xs font-semibold text-ink truncate">
            {item.episodeOrdinal > 0 ? `Эпизод ${item.episodeOrdinal}` : "Загрузка"}
          </span>
          <span className="text-[10px] text-ink-2">#{item.releaseId}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-accent-ink">{Math.round(item.percent)}%</span>
          <button
            type="button"
            aria-label={isDownloading ? "Отменить загрузку" : "Закрыть уведомление"}
            title={isDownloading ? "Отменить загрузку" : "Закрыть уведомление"}
            onClick={() => (isDownloading ? onCancel(item.episodeId) : onDismiss(item.episodeId))}
            className="p-1 text-ink-2 hover:text-accent-ink transition-colors cursor-pointer rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10 mb-1.5">
        <div
          className="h-full rounded-full bg-accent transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-ink-2">
        <span className="shrink-0">{formatBytes(item.downloadedBytes)}</span>
        <span className="truncate">
          {item.totalSegments > 0
            ? `${item.downloadedSegments} / ${item.totalSegments} сегментов`
            : "Загрузка…"}
        </span>
        <span className="shrink-0">{formatBytes(item.speed)}/с</span>
      </div>
      {item.error && <div className="mt-1 text-[10px] text-accent-ink truncate">{item.error}</div>}
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
    cancelDownload,
    cancelAllDownloads,
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
        <div className="w-80 md:w-96 rounded-2xl border border-ink/15 bg-surface-1/95 p-3.5 shadow-2xl backdrop-blur-2xl transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-accent-ink" />
              <span className="text-xs font-bold text-ink">Загрузки</span>
              <Badge className="h-4 px-1.5 text-[9px]">{items.length}</Badge>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Свернуть виджет"
                onClick={toggleWidgetExpanded}
                className="p-1 rounded-md text-ink-2 hover:text-ink hover:bg-ink/10 transition-colors cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Закрыть виджет"
                onClick={() => setWidgetVisible(false)}
                className="p-1 rounded-md text-ink-2 hover:text-ink hover:bg-ink/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {items.map((item) => (
              <DownloadItemRow
                key={item.episodeId}
                item={item}
                onCancel={cancelDownload}
                onDismiss={dismissDownload}
              />
            ))}
          </div>

          <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveScreen("downloads");
                toggleWidgetExpanded();
              }}
              className="inline-flex items-center gap-1.5 text-accent-ink hover:text-ink font-semibold cursor-pointer transition-colors"
            >
              <FolderDown className="h-3.5 w-3.5" />
              <span>Все скачанные</span>
            </button>

            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={cancelAllDownloads}
                  className="text-[11px] text-accent-ink hover:text-ink cursor-pointer transition-colors"
                >
                  Отменить все
                </button>
              )}
              {items.some((i) => i.status !== "DOWNLOADING") && (
                <button
                  type="button"
                  onClick={clearCompletedDownloads}
                  className="text-[11px] text-ink-2 hover:text-ink cursor-pointer transition-colors"
                >
                  Очистить
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleWidgetExpanded}
          className="flex items-center gap-2.5 rounded-full border border-accent/40 bg-surface-1/95 px-4 py-2.5 shadow-2xl backdrop-blur-2xl hover:border-accent hover:bg-surface-2 transition-all cursor-pointer group"
        >
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 text-accent-ink animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-ink" />
          )}
          <span className="text-xs font-semibold text-ink">
            {activeCount > 0 ? `Качается: ${activeCount}` : "Загрузки завершены"}
          </span>
          <span className="text-xs font-bold text-accent-ink">{avgPercent}%</span>
          <ChevronUp className="h-3.5 w-3.5 text-ink-2 group-hover:text-ink transition-colors" />
        </button>
      )}
    </div>
  );
}
