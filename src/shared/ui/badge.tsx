import type * as React from "react";
import { cn } from "../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold transition-colors";
  const variants = {
    default: "bg-accent/20 text-accent-ink border border-accent/30",
    secondary: "bg-ink/10 text-ink border border-ink/15 backdrop-blur-xs",
    outline: "border border-ink/20 text-ink-2",
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
