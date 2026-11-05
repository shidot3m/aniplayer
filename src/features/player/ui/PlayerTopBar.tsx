import { ArrowLeft, Sparkles } from "lucide-react";
import type { Release } from "@/shared/types";

export interface PlayerTopBarProps {
  isVisible: boolean;
  release: Release;
  /** The badge promises a filtered frame, so it shows only when the renderer is actually up. */
  enhancementActive?: boolean;
  onBack: () => void;
}

export function PlayerTopBar({
  isVisible,
  release,
  enhancementActive = false,
  onBack,
}: PlayerTopBarProps) {
  return (
    <div
      className={`absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-linear-to-b/srgb from-scrim/80 via-scrim/40 to-transparent p-6 transition-opacity duration-300 ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="player-back-btn"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-scrim/50 text-ink backdrop-blur-sm hover:bg-ink/20 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
          title="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-ink leading-tight">{release.name.main}</h2>
          {(release.name.alternative || release.name.english) && (
            <p className="text-xs text-ink-2">{release.name.alternative || release.name.english}</p>
          )}
        </div>
      </div>

      {enhancementActive && (
        <div className="flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-semibold text-accent-ink backdrop-blur-sm shadow-lg shadow-scrim/30">
          <Sparkles className="h-3.5 w-3.5 text-accent-ink" />
          <span>4K Upscale</span>
        </div>
      )}
    </div>
  );
}
