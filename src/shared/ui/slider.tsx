import type * as React from "react";
import { cn } from "../lib/utils";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  ariaLabel: string;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  ariaLabel,
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2 group cursor-pointer",
        className,
      )}
    >
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-ink/20">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percentage}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
      />
    </div>
  );
};
