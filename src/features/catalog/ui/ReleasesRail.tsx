import type { Release } from "@/shared/types";
import { SectionHead } from "@/shared/ui/section-head";
import { AnimeCard } from "./AnimeCard";
import { Rail } from "./Rail";

interface ReleasesRailProps {
  title: string;
  releases: Release[];
  onSelectRelease: (release: Release) => void;
}

/**
 * A horizontal poster rail (2:3 cards). The rail runs past the right edge so the next poster
 * peeks — the Netflix navigation the redesign is anchored on (#69).
 */
export function ReleasesRail({ title, releases, onSelectRelease }: ReleasesRailProps) {
  if (releases.length === 0) return null;

  return (
    <section className="pb-2">
      <SectionHead title={title} trailing={releases.length} />
      <Rail>
        {releases.map((release) => (
          <div key={release.id} className="w-[204px] shrink-0 snap-start">
            <AnimeCard release={release} onClick={() => onSelectRelease(release)} />
          </div>
        ))}
      </Rail>
    </section>
  );
}
