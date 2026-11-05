import { ArrowLeft } from "lucide-react";
import { formatTime } from "@/shared/lib/utils";
import type { EpisodeItem, Release } from "@/shared/types";

export interface PlayerTopBarProps {
  isVisible: boolean;
  release: Release;
  episode: EpisodeItem;
  currentTime: number;
  duration: number;
  onBack: () => void;
}

/**
 * The player top row (#72, ADR 0018): back, the Release named in the display weight, and the
 * Ordinal with the current position over the duration as timecodes — the position in the accent.
 * It appears and disappears instantly, so it never competes with the frame.
 */
export function PlayerTopBar({
  isVisible,
  release,
  episode,
  currentTime,
  duration,
  onBack,
}: PlayerTopBarProps) {
  return (
    <div
      className={
        isVisible
          ? "pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-linear-to-b from-scrim/85 to-transparent p-6"
          : "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-linear-to-b from-scrim/85 to-transparent p-6 opacity-0"
      }
    >
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          data-testid="player-back-btn"
          onClick={onBack}
          aria-label="Назад"
          title="Назад"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-[-0.01em] text-ink leading-tight">
            {release.name.main}
          </h2>
          <p data-testid="player-episode-label" className="mt-0.5 truncate text-sm text-ink-2">
            Эпизод <span className="tabular-nums">{episode.ordinal}</span> ·{" "}
            <span className="tabular-nums text-accent-ink">{formatTime(currentTime)}</span>
            <span className="mx-1 text-ink-3 tabular-nums">/</span>
            <span className="tabular-nums">{formatTime(duration)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
