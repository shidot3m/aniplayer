import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayerStore } from "@/features/player";
import type { PlayerHotkeysConfig } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";

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
  { id: "seekBack", label: "Перемотка назад", description: "-5с (Shift: -30с)" },
  { id: "seekForward", label: "Перемотка вперед", description: "+5с (Shift: +30с)" },
  { id: "volumeUp", label: "Увеличить громкость", description: "+5% громкости" },
  { id: "volumeDown", label: "Уменьшить громкость", description: "-5% громкости" },
  { id: "toggleMute", label: "Без звука (Mute)", description: "Вкл/выкл звук" },
  { id: "toggleFullscreen", label: "Полный экран", description: "Полноэкранный режим" },
  { id: "skipOpEd", label: "Пропуск OP / ED", description: "Пропуск заставки или титров" },
  { id: "nextEpisode", label: "Следующий эпизод", description: "Переход к след. серии" },
  { id: "prevEpisode", label: "Предыдущий эпизод", description: "Переход к пред. серии" },
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
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-[11px] text-ink-2">
          Нажмите на клавишу для назначения нового бинда
        </span>
        <button
          type="button"
          onClick={resetHotkeys}
          className="flex items-center gap-1.5 text-[11px] text-accent-ink hover:text-ink transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Сбросить</span>
        </button>
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {HOTKEY_ACTIONS.map((action) => {
          const currentKey = hotkeys[action.id];
          const isRecording = recordingAction === action.id;

          return (
            <div
              key={action.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-colors ${
                isRecording
                  ? "border-accent bg-accent/10 ring-1 ring-accent-ink"
                  : "border-ink/5 bg-ink/[0.02] hover:bg-ink/[0.04]"
              }`}
            >
              <div>
                <div className="font-medium text-ink">{action.label}</div>
                <div className="text-[10px] text-ink-2">{action.description}</div>
              </div>

              <button
                type="button"
                onClick={() => setRecordingAction(isRecording ? null : action.id)}
                className="cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-ink rounded-lg"
              >
                {isRecording ? (
                  <Badge className="animate-pulse px-2.5 py-1 text-[11px] font-mono font-semibold cursor-pointer">
                    Нажмите клавишу...
                  </Badge>
                ) : (
                  <kbd className="inline-flex min-w-8 items-center justify-center rounded-lg border border-ink/20 bg-ink/10 px-2 py-1 font-mono text-[11px] font-semibold text-ink shadow-xs hover:bg-ink/20 hover:border-ink/30 transition-colors">
                    {formatKeyName(currentKey)}
                  </kbd>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-line bg-ink/[0.02] p-2.5 text-[10px] text-ink-2 leading-relaxed">
        <span className="font-semibold text-ink-2">Дополнительно: </span>
        <span className="font-mono text-ink">Shift + 1..6</span> — выбор пресетов Anime4K,{" "}
        <span className="font-mono text-ink">Shift + 0</span> — отключение фильтра,{" "}
        <span className="font-mono text-ink">Esc</span> — отмена записи бинда.
      </div>
    </div>
  );
}
