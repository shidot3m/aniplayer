import { Check, Settings, Sparkles, Zap } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";

interface SettingsMenuProps {
  currentQuality: "1080p" | "720p" | "480p";
  onSelectQuality: (q: "1080p" | "720p" | "480p") => void;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

const SHADER_PRESETS = [
  { id: "Mode A+A (HQ)", label: "Mode A+A (HQ - Ультра 4K)" },
  { id: "Mode A (Fast)", label: "Mode A (Быстрый)" },
  { id: "Mode B+B (HQ)", label: "Mode B+B (HQ)" },
  { id: "Mode C+A (HQ)", label: "Mode C+A (HQ)" },
  { id: "Off", label: "Отключено" },
];

export function SettingsMenu({ currentQuality, onSelectQuality }: SettingsMenuProps) {
  const {
    speed,
    setSpeed,
    anime4kPreset,
    setAnime4kPreset,
    autoSkipOpEd,
    setAutoSkipOpEd,
    autoplayNext,
    setAutoplayNext,
  } = usePlayerStore();

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
        {/* Anime4K Preset */}
        <div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Апскейл Anime4K
          </span>
          <div className="space-y-1">
            {SHADER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAnime4kPreset(p.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${
                  anime4kPreset === p.id
                    ? "bg-rose-600/20 text-rose-300 font-semibold"
                    : "hover:bg-white/5 text-slate-300"
                }`}
              >
                <span>{p.label}</span>
                {anime4kPreset === p.id && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
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
            {(["1080p", "720p", "480p"] as const).map((q) => (
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
          <label className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white">
            <span>Пропуск OP / ED</span>
            <input
              type="checkbox"
              checked={autoSkipOpEd}
              onChange={(e) => setAutoSkipOpEd(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-rose-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white">
            <span>Автопереход к след. эпизоду</span>
            <input
              type="checkbox"
              checked={autoplayNext}
              onChange={(e) => setAutoplayNext(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-rose-500 cursor-pointer"
            />
          </label>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
