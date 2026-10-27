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
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-[11px] text-slate-400">
          Нажмите на клавишу для назначения нового бинда
        </span>
        <button
          type="button"
          onClick={resetHotkeys}
          className="flex items-center gap-1.5 text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
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
                  ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div>
                <div className="font-medium text-white">{action.label}</div>
                <div className="text-[10px] text-slate-400">{action.description}</div>
              </div>

              <button
                type="button"
                onClick={() => setRecordingAction(isRecording ? null : action.id)}
                className="cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded-lg"
              >
                {isRecording ? (
                  <Badge
                    variant="rose"
                    className="animate-pulse px-2.5 py-1 text-[11px] font-mono font-semibold cursor-pointer"
                  >
                    Нажмите клавишу...
                  </Badge>
                ) : (
                  <kbd className="inline-flex min-w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[11px] font-semibold text-white shadow-sm hover:bg-white/20 hover:border-white/30 transition-colors">
                    {formatKeyName(currentKey)}
                  </kbd>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-[10px] text-slate-400 leading-relaxed">
        <span className="font-semibold text-slate-300">Дополнительно: </span>
        <span className="font-mono text-slate-200">Shift + 1..4</span> — выбор пресетов Anime4K,{" "}
        <span className="font-mono text-slate-200">Shift + 0</span> — отключение фильтра,{" "}
        <span className="font-mono text-slate-200">Esc</span> — отмена записи бинда.
      </div>
    </div>
  );
}
