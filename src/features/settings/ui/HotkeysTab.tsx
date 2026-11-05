import { useEffect, useState } from "react";
import { usePlayerStore } from "@/features/player";
import type { PlayerHotkeysConfig } from "@/shared/types";

export function formatKeyName(code: string): string {
  if (!code) return "Не назначено";
  if (code === "Space") return "Пробел";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "Enter") return "Enter";
  if (code === "Backspace") return "Backspace";
  if (code === "Tab") return "Tab";
  if (code.startsWith("Key")) return code.replace("Key", "");
  if (code.startsWith("Digit")) return code.replace("Digit", "");
  return code;
}

const HOTKEY_ACTIONS: {
  id: keyof PlayerHotkeysConfig;
  label: string;
  description: string;
}[] = [
  { id: "togglePlay", label: "Воспроизведение / Пауза", description: "Старт или пауза видео" },
  { id: "seekBack", label: "Перемотка назад", description: "−5 с (Shift: −30 с)" },
  { id: "seekForward", label: "Перемотка вперёд", description: "+5 с (Shift: +30 с)" },
  { id: "volumeUp", label: "Увеличить громкость", description: "+5% громкости" },
  { id: "volumeDown", label: "Уменьшить громкость", description: "−5% громкости" },
  { id: "toggleMute", label: "Без звука", description: "включить или выключить звук" },
  { id: "toggleFullscreen", label: "Во весь экран", description: "Полноэкранный режим" },
  { id: "skipOpEd", label: "Пропуск OP / ED", description: "Пропустить заставку или титры" },
  { id: "nextEpisode", label: "Следующий эпизод", description: "перейти к следующей серии" },
  { id: "prevEpisode", label: "Предыдущий эпизод", description: "перейти к предыдущей серии" },
];

export function HotkeysTab({ isOpen }: { isOpen: boolean }) {
  const [recordingAction, setRecordingAction] = useState<keyof PlayerHotkeysConfig | null>(null);
  const { hotkeys, setHotkey, resetHotkeys } = usePlayerStore();

  useEffect(() => {
    if (!recordingAction || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === "Escape") {
        setRecordingAction(null);
        return;
      }

      setHotkey(recordingAction, e.code);
      setRecordingAction(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingAction, isOpen, setHotkey]);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <span className="text-[12px] text-ink-3">Кликните по клавише, чтобы назначить новую</span>
        <button
          type="button"
          onClick={resetHotkeys}
          className="cursor-pointer text-[12px] text-ink-2 transition-colors hover:text-ink"
        >
          Сбросить
        </button>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {HOTKEY_ACTIONS.map((action) => {
          const currentKey = hotkeys[action.id];
          const isRecording = recordingAction === action.id;

          return (
            <div
              key={action.id}
              className={
                isRecording
                  ? "flex items-center justify-between rounded-lg border border-accent bg-accent/10 px-3 py-2"
                  : "flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-ink/5"
              }
            >
              <div>
                <div className="text-[13px] text-ink">{action.label}</div>
                <div className="text-[11px] text-ink-3">{action.description}</div>
              </div>

              <button
                type="button"
                onClick={() => setRecordingAction(isRecording ? null : action.id)}
                className="cursor-pointer rounded-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                {isRecording ? (
                  <span className="text-[12px] font-medium text-accent-ink">Нажмите клавишу</span>
                ) : (
                  <kbd className="inline-flex min-w-9 items-center justify-center rounded-md border border-line bg-surface-2 px-2 py-1 text-[12px] font-medium tabular-nums text-ink">
                    {formatKeyName(currentKey)}
                  </kbd>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">
        Дополнительно: Shift + 1…6 выбирает пресет Anime4K, Shift + 0 выключает фильтр, Esc отменяет
        запись.
      </p>
    </div>
  );
}
