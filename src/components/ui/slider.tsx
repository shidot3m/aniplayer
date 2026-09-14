import type * as React from "react";
import { cn } from "../../lib/utils";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
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
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/20 group-hover:h-2 transition-all">
        <div
          className="h-full bg-rose-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
      />
    </div>
  );
};
