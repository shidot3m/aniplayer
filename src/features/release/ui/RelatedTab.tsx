import { Film, Loader2 } from "lucide-react";
import { AnimeCard } from "@/features/catalog";
import type { FranchiseItem, Release } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";

export interface RelatedTabProps {
  isLoading: boolean;
  franchises: FranchiseItem[];
  currentReleaseId: number;
  onSelectRelease: (r: Release) => void;
}

export function RelatedTab({
  isLoading,
  franchises,
  currentReleaseId,
  onSelectRelease,
}: RelatedTabProps) {
  if (isLoading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-accent-ink" />
        <p className="text-xs text-ink-2">Загрузка связанных релизов...</p>
      </div>
    );
  }

  const hasReleases = franchises.some((f) => (f.franchise_releases?.length || 0) > 0);
  if (!hasReleases) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-1/40 p-6 text-center text-ink-2">
        <Film className="mb-2 h-10 w-10 text-ink-3" />
        <h4 className="text-sm font-semibold text-ink-2">Нет связанных сезонов</h4>
        <p className="mt-1 text-xs text-ink-2">
          Для этого аниме нет других частей или фильмов в базе
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {franchises.map((franchise) => (
        <div key={franchise.id} className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <h3 className="text-sm font-bold text-ink">{franchise.name}</h3>
              <span className="text-xs text-ink-2">
                Релизов в серии: {franchise.franchise_releases?.length || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {franchise.franchise_releases?.map((item) => {
              const rel = item.release;
              if (!rel) return null;
              const isCurrent = rel.id === currentReleaseId;

              return (
                <div key={item.id} className="relative group">
                  <AnimeCard release={rel} onClick={() => onSelectRelease(rel)} />
                  {isCurrent && (
                    <div className="pointer-events-none absolute left-2 top-2 z-20">
                      <Badge className="text-[10px] shadow-lg">Текущий</Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
