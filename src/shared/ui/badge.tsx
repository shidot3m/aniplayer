import type * as React from "react";
import { cn } from "../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "accent" | "rose";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold transition-colors";
  const variants = {
    default: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    rose: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    secondary: "bg-white/10 text-slate-200 border border-white/15 backdrop-blur-xs",
    outline: "border border-white/20 text-slate-300",
    accent: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
