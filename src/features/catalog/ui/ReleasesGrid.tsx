import { Loader2 } from "lucide-react";
import type { Release } from "@/shared/types";
import { SectionHead } from "@/shared/ui/section-head";
import { useCatalogStore } from "../state/catalogStore";
import { AnimeCard } from "./AnimeCard";

interface ReleasesGridProps {
  onSelectRelease: (release: Release) => void;
}

/** The search result surface: a quiet grid of poster cards, titled by how many matched. */
export function ReleasesGrid({ onSelectRelease }: ReleasesGridProps) {
  const { searchResults, isSearching, searchQuery } = useCatalogStore();

  const title = searchQuery.trim() ? `Результаты поиска` : "Новые релизы";

  return (
    <div className="px-12 py-8">
      {isSearching ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-ink" />
        </div>
      ) : searchResults.length > 0 ? (
        <>
          <SectionHead title={title} trailing={searchResults.length} className="mb-5 px-0" />
          <div className="grid grid-cols-3 gap-x-5 gap-y-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {searchResults.map((release: Release) => (
              <AnimeCard
                key={release.id}
                release={release}
                onClick={() => onSelectRelease(release)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-ink-2">
          <p>Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
