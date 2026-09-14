import { ArrowLeft } from "lucide-react";
import type { Release } from "../../types";

export interface PlayerTopBarProps {
  isVisible: boolean;
  release: Release;
  onBack: () => void;
}

export function PlayerTopBar({ isVisible, release, onBack }: PlayerTopBarProps) {
  return (
    <div
      className={`absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-6 transition-opacity duration-300 ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="player-back-btn"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          title="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-white leading-tight">{release.name.main}</h2>
          {(release.name.alternative || release.name.english) && (
            <p className="text-xs text-slate-300">
              {release.name.alternative || release.name.english}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
