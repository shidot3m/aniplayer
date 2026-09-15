import { Play } from "lucide-react";
import { CDN_BASE_URL } from "../lib/constants";
import { formatTime } from "../lib/utils";
import { useCatalogStore } from "../store/catalogStore";
import { usePlayerStore } from "../store/playerStore";
import type { HistoryItem, Release } from "../types";

interface ContinueWatchingProps {
  onSelectRelease: (release: Release) => void;
}

export function ContinueWatching({ onSelectRelease }: ContinueWatchingProps) {
  const { history, latestReleases } = useCatalogStore();
  const { playEpisode } = usePlayerStore();

  // Take up to 4 most recently watched in-progress items
  const recentHistory = (history || [])
    .filter((item) => !item.is_completed && item.last_position > 0)
    .slice(0, 4);

  if (!recentHistory.length) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Продолжить просмотр
        </h2>
        <span className="text-xs text-slate-400">{recentHistory.length} в процессе</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {recentHistory.map((item: HistoryItem) => {
          // Attempt to find release details in latestReleases
          const release = latestReleases.find((r) => r.id === item.release_id);
          const progressPercent =
            item.duration > 0
              ? Math.min(100, Math.round((item.last_position / item.duration) * 100))
              : 0;

          const title = release?.name?.main || `Аниме #${item.release_id}`;
          const poster =
            release?.poster?.thumbnail || release?.poster?.preview || release?.poster?.src || "";
          const formattedPoster =
            poster.startsWith("http") || poster.startsWith("data:")
              ? poster
              : poster
                ? `${CDN_BASE_URL}${poster}`
                : "";

          return (
            <div
              key={`${item.release_id}-${item.episode_id}`}
              className="group relative flex overflow-hidden rounded-xl border border-white/5 bg-[#12131A] p-3 transition-all duration-300 hover:border-white/20 hover:bg-[#161822]"
            >
              {/* Thumbnail / Poster */}
              <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-black/40">
                {formattedPoster ? (
                  <img
                    src={formattedPoster}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-[10px] text-slate-500">
                    N/A
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Продолжить воспроизведение"
                  onClick={() => {
                    if (release) {
                      const ep = release.episodes?.find((e) => e.id === item.episode_id);
                      if (ep) {
                        playEpisode(release, ep);
                        return;
                      }
                      onSelectRelease(release);
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                >
                  <Play className="h-6 w-6 fill-rose-500 text-rose-500" />
                </button>
              </div>

              {/* Info & Progress */}
              <div className="ml-3 flex flex-1 flex-col justify-between overflow-hidden">
                <div>
                  <button
                    type="button"
                    onClick={() => release && onSelectRelease(release)}
                    className="text-left text-xs font-semibold text-white truncate block w-full hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    {title}
                  </button>
                  <p className="mt-0.5 text-[11px] text-rose-400">Эпизод {item.episode_ordinal}</p>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{formatTime(item.last_position)}</span>
                    <span>{formatTime(item.duration)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
