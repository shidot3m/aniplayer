import type React from "react";
import { useState } from "react";
import { formatTime } from "../../shared/lib/utils";
import type { SkipTimecode } from "../../shared/types";

interface SeekBarProps {
  currentTime: number;
  duration: number;
  opening?: SkipTimecode | null;
  ending?: SkipTimecode | null;
  onSeek: (seconds: number) => void;
}

export function SeekBar({ currentTime, duration, opening, ending, onSeek }: SeekBarProps) {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const opStartPercent =
    duration > 0 && opening?.start != null
      ? Math.max(0, Math.min(100, (opening.start / safeDuration) * 100))
      : null;
  const opStopPercent =
    duration > 0 && opening?.stop != null
      ? Math.max(0, Math.min(100, (opening.stop / safeDuration) * 100))
      : null;
  const opWidthPercent =
    opStartPercent != null && opStopPercent != null
      ? Math.max(0, opStopPercent - opStartPercent)
      : 0;

  const edStartPercent =
    duration > 0 && ending?.start != null
      ? Math.max(0, Math.min(100, (ending.start / safeDuration) * 100))
      : null;
  const edStopPercent =
    duration > 0 && ending?.stop != null
      ? Math.max(0, Math.min(100, (ending.stop / safeDuration) * 100))
      : null;
  const edWidthPercent =
    edStartPercent != null && edStopPercent != null
      ? Math.max(0, edStopPercent - edStartPercent)
      : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * safeDuration);
  };

  const hoverPercent = hoverPosition !== null ? (hoverPosition / safeDuration) * 100 : 0;

  const isHoverInOpening =
    hoverPosition !== null &&
    opening?.start != null &&
    opening?.stop != null &&
    hoverPosition >= opening.start &&
    hoverPosition <= opening.stop;

  const isHoverInEnding =
    hoverPosition !== null &&
    ending?.start != null &&
    ending?.stop != null &&
    hoverPosition >= ending.start &&
    hoverPosition <= ending.stop;

  return (
    <div className="group relative flex h-6 w-full items-center">
      {/* Tooltip on Hover */}
      {hoverPosition !== null && duration > 0 && (
        <div
          className="absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-2 py-0.5 text-[11px] font-medium text-white shadow backdrop-blur pointer-events-none whitespace-nowrap z-30 flex items-center gap-1.5"
          style={{ left: `${Math.min(95, Math.max(5, hoverPercent))}%` }}
        >
          <span>{formatTime(hoverPosition)}</span>
          {isHoverInOpening && (
            <span className="text-amber-400 font-semibold text-[10px]">· Опенинг</span>
          )}
          {isHoverInEnding && (
            <span className="text-indigo-400 font-semibold text-[10px]">· Эндинг</span>
          )}
        </div>
      )}

      {/* Track Base */}
      <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-all group-hover:h-2 pointer-events-none overflow-hidden">
        {/* Opening Marker Segment */}
        {opStartPercent != null && opWidthPercent > 0 && (
          <div
            data-testid="seekbar-opening-marker"
            title="Опенинг"
            className="absolute top-0 h-full bg-amber-400/80 shadow-sm pointer-events-none"
            style={{ left: `${opStartPercent}%`, width: `${opWidthPercent}%` }}
          />
        )}

        {/* Ending Marker Segment */}
        {edStartPercent != null && edWidthPercent > 0 && (
          <div
            data-testid="seekbar-ending-marker"
            title="Эндинг"
            className="absolute top-0 h-full bg-indigo-400/80 shadow-sm pointer-events-none"
            style={{ left: `${edStartPercent}%`, width: `${edWidthPercent}%` }}
          />
        )}

        {/* Hover Highlight */}
        {hoverPosition !== null && (
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-white/10"
            style={{ width: `${hoverPercent}%` }}
          />
        )}

        {/* Played Progress */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-rose-600 shadow-sm transition-all"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-lg transition-transform scale-0 group-hover:scale-100 group-focus-within:scale-100"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Accessible native range input */}
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        aria-label="Шкала времени"
        onChange={(e) => onSeek(Number(e.target.value))}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPosition(null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:opacity-20 focus-visible:ring-2 focus-visible:ring-rose-500 rounded-full"
      />
    </div>
  );
}
