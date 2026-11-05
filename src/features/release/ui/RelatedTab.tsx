import { Loader2 } from "lucide-react";
import { AnimeCard, Rail } from "@/features/catalog";
import type { FranchiseItem, Release } from "@/shared/types";
import { SectionHead } from "@/shared/ui/section-head";

export interface RelatedTabProps {
  isLoading: boolean;
  franchises: FranchiseItem[];
  currentReleaseId: number;
  onSelectRelease: (r: Release) => void;
}

/**
 * The "related" block (#70): the franchise in chronological order, each release a small poster
 * numbered by its place in the story, the current release marked. Clicking any poster opens it.
 */
export function RelatedTab({
  isLoading,
  franchises,
  currentReleaseId,
  onSelectRelease,
}: RelatedTabProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center px-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent-ink" />
      </div>
    );
  }

  const orderedFranchises = franchises
    .map((franchise) => ({
      ...franchise,
      ordered: [...(franchise.franchise_releases || [])]
        .filter((item) => item.release)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))
    .filter((franchise) => franchise.ordered.length > 0);

  if (orderedFranchises.length === 0) return null;

  return (
    <div className="pb-4">
      {orderedFranchises.map((franchise) => (
        <section key={franchise.id ?? franchise.name} className="mt-8">
          <SectionHead title="Связанное" trailing="по порядку франшизы" className="mb-1" />
          <Rail>
            {franchise.ordered.map((item, index) => {
              const rel = item.release as Release;
              const isCurrent = rel.id === currentReleaseId;
              return (
                <div key={item.id ?? rel.id} className="w-[128px] shrink-0 snap-start">
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1.5 left-1.5 z-20 rounded-[5px] bg-ground/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink">
                      {index + 1}
                    </span>
                    <AnimeCard release={rel} onClick={() => onSelectRelease(rel)} />
                  </div>
                  {isCurrent && (
                    <p className="mt-1 px-0.5 text-[12px] text-accent-ink">Сейчас смотрите</p>
                  )}
                </div>
              );
            })}
          </Rail>
        </section>
      ))}
    </div>
  );
}
