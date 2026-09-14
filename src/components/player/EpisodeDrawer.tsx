import { CheckCircle2, Play, X } from "lucide-react";
import { CDN_BASE_URL } from "../../lib/constants";
import { formatTime } from "../../lib/utils";
import type { EpisodeItem, Release } from "../../types";

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      {/* Drawer Body */}
      <div className="relative z-50 flex h-full w-80 md:w-96 flex-col border-l border-white/10 bg-[#12131A]/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Список эпизодов</h3>
            <span className="text-xs text-slate-400">Всего: {release.episodes?.length || 0}</span>
          </div>
          <button
            type="button"
            aria-label="Закрыть окно"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
              ep.preview?.optimized?.thumbnail ||
              ep.preview?.optimized?.preview ||
              ep.preview?.thumbnail ||
              ep.preview?.preview ||
              ep.preview?.src;
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
                    ? "bg-rose-600/20 border border-rose-500/40 text-white"
                    : "hover:bg-white/5 text-slate-300 border border-transparent"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-black/40">
                  {formattedThumb ? (
                    <img
                      src={formattedThumb}
                      alt={`Эпизод ${ep.ordinal}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                      #{ep.ordinal}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-rose-400">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  )}

                  {isWatched && !isCurrent && (
                    <div className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Эпизод {ep.ordinal}</span>
                    {ep.duration ? (
                      <span className="text-[10px] text-slate-400">{formatTime(ep.duration)}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
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
