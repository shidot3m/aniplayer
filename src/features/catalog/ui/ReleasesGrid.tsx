import { Film, Loader2 } from "lucide-react";
import type { Release } from "@/shared/types";
import { useCatalogStore } from "../state/catalogStore";
import { AnimeCard } from "./AnimeCard";

interface ReleasesGridProps {
  onSelectRelease: (release: Release) => void;
}

export function ReleasesGrid({ onSelectRelease }: ReleasesGridProps) {
  const { latestReleases, searchResults, isSearching, searchQuery } = useCatalogStore();
  const displayedReleases = searchQuery.trim() ? searchResults : latestReleases;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
          <Film className="h-4 w-4 text-accent-ink" />
          {searchQuery ? `Результаты поиска (${searchResults.length})` : "Свежие релизы"}
        </h2>
      </div>

      {isSearching ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-ink" />
        </div>
      ) : displayedReleases.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-12">
          {displayedReleases.map((release) => (
            <AnimeCard
              key={release.id}
              release={release}
              onClick={() => onSelectRelease(release)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-ink/[0.02] backdrop-blur-md text-center mb-12">
          <p className="text-sm text-ink-2">Релизы не найдены</p>
        </div>
      )}
    </>
  );
}
