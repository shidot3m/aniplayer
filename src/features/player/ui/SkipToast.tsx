import { FastForward, Play } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/shared/ui/button";

interface SkipToastProps {
  type: "opening" | "ending" | "next_episode";
  countdownSeconds?: number;
  onSkip: () => void;
}

export function SkipToast({ type, countdownSeconds, onSkip }: SkipToastProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "s" || e.key === "S" || e.key === "ы" || e.key === "Ы") &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        onSkip();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSkip]);

  if (type === "next_episode") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-scrim/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <span className="text-xs font-semibold text-ink">
          Следующий эпизод через{" "}
          <span className="text-accent-ink font-bold">{countdownSeconds ?? 0}</span> с
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={onSkip}
          className="h-8 gap-1.5 px-3 text-xs font-bold"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Включить сейчас (S)</span>
        </Button>
      </div>
    );
  }

  const label = type === "opening" ? "опенинг" : "эндинг";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/20 bg-scrim/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
      <Button
        variant="secondary"
        size="sm"
        onClick={onSkip}
        className="h-8 gap-2 px-3 text-xs bg-ink/15 hover:bg-ink/25 text-ink font-bold cursor-pointer"
      >
        <FastForward className="h-4 w-4 text-accent-ink" />
        <span>Пропустить {label} (S)</span>
      </Button>
    </div>
  );
}
