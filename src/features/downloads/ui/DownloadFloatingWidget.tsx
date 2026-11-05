import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { useCatalogStore } from "@/features/catalog";
import { formatBytes } from "@/shared/lib/utils";
import type { DownloadProgressEvent } from "@/shared/types";
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
    <div className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-ink-2" />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-accent-ink" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-ink" />
          )}
          <span className="truncate text-[13px] text-ink tabular-nums">
            {item.episodeOrdinal > 0 ? `Эпизод ${item.episodeOrdinal}` : "Загрузка"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[13px] tabular-nums text-accent-ink">
            {Math.round(item.percent)}%
          </span>
          <button
            type="button"
            aria-label={isDownloading ? "Отменить загрузку" : "Закрыть уведомление"}
            title={isDownloading ? "Отменить загрузку" : "Закрыть уведомление"}
            onClick={() => (isDownloading ? onCancel(item.episodeId) : onDismiss(item.episodeId))}
            className="cursor-pointer rounded p-1 text-ink-3 transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-1.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-ink-3">
        <span className="shrink-0">{formatBytes(item.downloadedBytes)}</span>
        <span className="truncate">
          {item.totalSegments > 0
            ? `${item.downloadedSegments} / ${item.totalSegments} сегментов`
            : "Загрузка…"}
        </span>
        <span className="shrink-0">{formatBytes(item.speed)}/с</span>
      </div>
      {item.error && <div className="mt-1 truncate text-[11px] text-accent-ink">{item.error}</div>}
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
    <div className="fixed bottom-6 right-6 z-50 flex select-none flex-col items-end pointer-events-auto">
      {isWidgetExpanded ? (
        <div className="w-80 rounded-2xl border border-line bg-surface-2 p-4 shadow-float md:w-96">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-ink">Загрузки</span>
              <span className="text-[12px] tabular-nums text-ink-3">{items.length}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Свернуть виджет"
                onClick={toggleWidgetExpanded}
                className="cursor-pointer rounded-md p-1 text-ink-3 transition-colors hover:bg-ink/10 hover:text-ink"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Закрыть виджет"
                onClick={() => setWidgetVisible(false)}
                className="cursor-pointer rounded-md p-1 text-ink-3 transition-colors hover:bg-ink/10 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto pr-1">
            {items.map((item) => (
              <DownloadItemRow
                key={item.episodeId}
                item={item}
                onCancel={cancelDownload}
                onDismiss={dismissDownload}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[13px]">
            <button
              type="button"
              onClick={() => {
                setActiveScreen("downloads");
                toggleWidgetExpanded();
              }}
              className="cursor-pointer text-ink-2 transition-colors hover:text-ink"
            >
              Все загрузки
            </button>

            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={cancelAllDownloads}
                  className="cursor-pointer text-[12px] text-ink-2 transition-colors hover:text-accent-ink"
                >
                  Отменить все
                </button>
              )}
              {items.some((i) => i.status !== "DOWNLOADING") && (
                <button
                  type="button"
                  onClick={clearCompletedDownloads}
                  className="cursor-pointer text-[12px] text-ink-2 transition-colors hover:text-ink"
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
          className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-line bg-surface-2 px-4 py-2.5 shadow-float transition-colors hover:border-ink/20"
        >
          {activeCount > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent-ink" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-ink-2" />
          )}
          <span className="text-[13px] text-ink">
            {activeCount > 0 ? `Загрузка · ${activeCount}` : "Загрузки завершены"}
          </span>
          <span className="text-[13px] tabular-nums text-accent-ink">{avgPercent}%</span>
          <ChevronUp className="h-3.5 w-3.5 text-ink-3 transition-colors group-hover:text-ink" />
        </button>
      )}
    </div>
  );
}
