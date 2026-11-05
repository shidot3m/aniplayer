import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeadProps {
  title: string;
  /** Quiet count or note at the end of the line — states are text and tone, never a badge (ADR 0018). */
  trailing?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHead({ title, trailing, action, className }: SectionHeadProps) {
  return (
    <div className={cn("flex items-baseline gap-3 px-12", className)}>
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {trailing != null && <span className="text-[13px] tabular-nums text-ink-3">{trailing}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
