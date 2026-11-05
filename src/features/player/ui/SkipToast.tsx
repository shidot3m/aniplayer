import { Check, FastForward, Play } from "lucide-react";
import { useEffect } from "react";
import { formatTime } from "@/shared/lib/utils";

interface SkipToastProps {
  type: "opening" | "ending" | "next_episode";
  /** Where the skip lands, shown as the trailing timecode. */
  targetSeconds?: number | null;
  countdownSeconds?: number;
  onSkip: () => void;
}

/**
 * A floating player prompt (#72, ADR 0018): glass is the only ornament over the frame, and it
 * appears instantly — these show dozens of times a session, so there is no entrance animation.
 */
export function SkipToast({ type, targetSeconds, countdownSeconds, onSkip }: SkipToastProps) {
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
      <button
        type="button"
        onClick={onSkip}
        className="glass flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-ink shadow-float focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
      >
        <span className="text-ink-2">
          Следующий эпизод через{" "}
          <span className="tabular-nums text-accent-ink">{countdownSeconds ?? 0}</span> с
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <Play className="h-4 w-4 fill-current" />
          <span>Сейчас (S)</span>
        </span>
      </button>
    );
  }

  const label = type === "opening" ? "опенинг" : "эндинг";

  return (
    <button
      type="button"
      onClick={onSkip}
      className="glass flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-ink shadow-float focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      {type === "opening" ? (
        <FastForward className="h-4 w-4 text-accent-ink" />
      ) : (
        <Check className="h-4 w-4 text-accent-ink" />
      )}
      <span>Пропустить {label} (S)</span>
      {targetSeconds != null && (
        <span className="tabular-nums text-ink-2">→ {formatTime(targetSeconds)}</span>
      )}
    </button>
  );
}
