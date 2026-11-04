import { Settings, Sparkles, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Switch } from "@/shared/ui/switch";
import { useEnhancement } from "../renderer/useEnhancement";
import { usePlayerStore } from "../state/playerStore";

interface SettingsMenuProps {
  currentQuality: "1080p" | "720p" | "480p";
  availableQualities?: ("1080p" | "720p" | "480p")[];
  onSelectQuality: (q: "1080p" | "720p" | "480p") => void;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

export function SettingsMenu({
  currentQuality,
  availableQualities,
  onSelectQuality,
}: SettingsMenuProps) {
  const {
    speed,
    setSpeed,
    setAnime4kEnabled,
    autoSkipOpEd,
    setAutoSkipOpEd,
    autoplayNext,
    setAutoplayNext,
  } = usePlayerStore();

  const { active, blocked, fault } = useEnhancement();
  const upscalerHint = blocked ?? fault ?? (active ? "Включен" : "Выключен");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
          title="Настройки плеера"
        >
          <Settings className="h-4 w-4" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="right" className="w-72 p-3 space-y-3">
        {/* Upscaler Toggle Only (No presets dropdown in player, preset chosen in App Settings) */}
        <div className="flex items-center justify-between py-1">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <Sparkles className="h-3.5 w-3.5" />
              Апскейлер 4K
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">{upscalerHint}</span>
          </div>
          <Switch
            checked={active}
            disabled={blocked !== null}
            onCheckedChange={setAnime4kEnabled}
            aria-label="Переключить апскейлер 4K"
          />
        </div>

        <div className="h-[1px] bg-white/10" />

        {/* Playback Speed */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Скорость
          </span>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`flex-1 rounded-md py-1 text-center text-[11px] font-medium transition-colors cursor-pointer ${
                  speed === s
                    ? "bg-rose-600 text-white"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="h-[1px] bg-white/10" />

        {/* Quality */}
        <div>
          <span className="block text-xs font-semibold text-slate-200 mb-1.5">Качество видео</span>
          <div className="flex gap-1">
            {(availableQualities || ["1080p", "720p", "480p"]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSelectQuality(q)}
                className={`flex-1 rounded-md py-1 text-center text-[11px] font-medium transition-colors cursor-pointer ${
                  currentQuality === q
                    ? "bg-rose-600 text-white"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[1px] bg-white/10" />

        {/* Toggles */}
        <div className="space-y-2 pt-1 text-[11px]">
          <div className="flex items-center justify-between text-slate-300 hover:text-white">
            <span>Пропуск OP / ED</span>
            <Switch
              checked={autoSkipOpEd}
              onCheckedChange={setAutoSkipOpEd}
              aria-label="Пропуск опенингов и эндингов"
            />
          </div>

          <div className="flex items-center justify-between text-slate-300 hover:text-white">
            <span>Автопереход к след. серии</span>
            <Switch
              checked={autoplayNext}
              onCheckedChange={setAutoplayNext}
              aria-label="Автопереход к следующей серии"
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
