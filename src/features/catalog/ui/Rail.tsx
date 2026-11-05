import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

interface RailProps {
  children: ReactNode;
  /** Pixels scrolled per arrow press. */
  scrollBy?: number;
  className?: string;
}

/**
 * A horizontal rail in the Netflix sense: cards run past the right edge so the next one peeks,
 * and it scrolls. Arrow buttons appear only while hovering the rail and only on a pointer device
 * (`(hover: hover)`), matching the motion charter in ADR 0018.
 */
export function Rail({ children, scrollBy = 640, className }: RailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkBounds = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkBounds();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => checkBounds());
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkBounds]);

  const scroll = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * scrollBy, behavior: "smooth" });
  };

  return (
    <div className="group/rail relative">
      <div
        ref={scrollerRef}
        onScroll={checkBounds}
        className={cn(
          "no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth px-12 py-4",
          className,
        )}
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="Прокрутить назад"
        onClick={() => scroll(-1)}
        disabled={!canScrollLeft}
        className={cn(
          "absolute top-1/2 left-1 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full glass text-ink shadow-float transition-opacity",
          canScrollLeft
            ? "cursor-pointer opacity-0 group-hover/rail:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Прокрутить вперёд"
        onClick={() => scroll(1)}
        disabled={!canScrollRight}
        className={cn(
          "absolute top-1/2 right-1 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full glass text-ink shadow-float transition-opacity",
          canScrollRight
            ? "cursor-pointer opacity-0 group-hover/rail:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
