import * as React from "react";
import { cn } from "../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variants = {
      // ADR 0018: the primary action is off-white with dark text; crimson is reserved for fills,
      // bars, outlines and the destructive action.
      default: "bg-ink text-ground hover:bg-ink-2 shadow-xs",
      secondary: "bg-ink/10 text-ink hover:bg-ink/15 border border-ink/15 backdrop-blur-md",
      outline: "border border-line bg-transparent hover:bg-ink/5 text-ink",
      ghost: "hover:bg-ink/5 text-ink-2 hover:text-ink",
      destructive: "bg-accent text-ink hover:bg-accent-ink",
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-6 text-base",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
