import { CheckCircle2, Play, X } from "lucide-react";
import { CDN_BASE_URL } from "@/shared/lib/constants";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem, Release } from "@/shared/types";

interface EpisodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  release: Release;
  currentEpisode: EpisodeItem;
  watchedEpIds: Set<string>;
  onSelectEpisode: (ep: EpisodeItem) => void;
}

export function EpisodeDrawer({
  isOpen,
  onClose,
  release,
  currentEpisode,
  watchedEpIds,
  onSelectEpisode,
}: EpisodeDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Закрыть список эпизодов"
        onClick={onClose}
        className="fixed inset-0 bg-scrim/60 backdrop-blur-xs cursor-default"
      />

      {/* Drawer Body */}
      <div className="relative z-50 flex h-full w-80 md:w-96 flex-col border-l border-line bg-surface-1/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-bold text-ink">Список эпизодов</h3>
            <span className="text-xs text-ink-2">Всего: {release.episodes?.length || 0}</span>
          </div>
          <button
            type="button"
            aria-label="Закрыть окно"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-2 hover:bg-ink/10 hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Episodes Scroll List */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {release.episodes?.map((ep) => {
            const isCurrent = ep.id === currentEpisode.id;
            const isWatched = watchedEpIds.has(ep.id);

            const rawThumb =
              ep.preview?.optimized?.src ||
              ep.preview?.src ||
              ep.preview?.optimized?.preview ||
              ep.preview?.preview ||
              ep.preview?.optimized?.thumbnail ||
              ep.preview?.thumbnail;
            const fallbackPoster =
              release.poster?.preview || release.poster?.src || release.poster?.thumbnail;
            const targetThumb = rawThumb || fallbackPoster;
            const formattedThumb = targetThumb?.startsWith("http")
              ? targetThumb
              : targetThumb
                ? `${CDN_BASE_URL}${targetThumb.startsWith("/") ? targetThumb : `/${targetThumb}`}`
                : "";

            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => {
                  onSelectEpisode(ep);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-accent/20 border border-accent/40 text-ink"
                    : "hover:bg-ink/5 text-ink-2 border border-transparent"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-scrim/40">
                  {formattedThumb ? (
                    <img
                      src={formattedThumb}
                      alt={`Эпизод ${ep.ordinal}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-2">
                      #{ep.ordinal}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-scrim/40 text-accent-ink">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  )}

                  {isWatched && !isCurrent && (
                    <div className="absolute right-1 top-1 rounded bg-scrim/70 p-0.5 text-ink">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Эпизод {ep.ordinal}</span>
                    {ep.duration ? (
                      <span className="text-[10px] text-ink-2">{formatTime(ep.duration)}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-2">
                    {ep.name || `Эпизод ${ep.ordinal}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
