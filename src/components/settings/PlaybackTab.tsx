import { Sparkles, Tv, Volume2 } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { VideoQuality } from "../../types";
import { Slider } from "../ui/slider";

const QUALITY_OPTIONS: { id: VideoQuality; title: string; desc: string }[] = [
  { id: "1080p", title: "1080p (Full HD)", desc: "Максимальная четкость" },
  { id: "720p", title: "720p (HD)", desc: "Баланс качества и трафика" },
  { id: "480p", title: "480p (SD)", desc: "Экономия трафика" },
];

const SHADER_PRESETS = [
  { id: "Mode A+A (HQ)", label: "Mode A+A (HQ)" },
  { id: "Mode A (Fast)", label: "Mode A (Fast)" },
  { id: "Mode B+B (HQ)", label: "Mode B+B (HQ)" },
  { id: "Mode C+A (HQ)", label: "Mode C+A (HQ)" },
  { id: "Off", label: "Отключено" },
];

export function PlaybackTab() {
  const {
    volume,
    setVolume,
    preferredQuality,
    setPreferredQuality,
    anime4kPreset,
    setAnime4kPreset,
    autoSkipOpEd,
    setAutoSkipOpEd,
    autoplayNext,
    setAutoplayNext,
  } = usePlayerStore();

  return (
    <div className="space-y-5 text-xs text-slate-300">
      {/* Preferred Quality Fixing */}
      <div>
        <div className="flex items-center gap-1.5 font-medium text-slate-200 mb-2">
          <Tv className="h-3.5 w-3.5 text-rose-500" />
          <span>Качество видео по умолчанию (Фиксирование качества)</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreferredQuality(opt.id)}
              className={`rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                preferredQuality === opt.id
                  ? "border-rose-500 bg-rose-500/15 text-white font-semibold"
                  : "border-white/10 bg-white/[0.02] backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <div className="font-bold text-[11px] text-white">{opt.title}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div>
        <div className="flex items-center justify-between mb-2 font-medium text-slate-200">
          <span className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-rose-500" />
            Громкость по умолчанию
          </span>
          <span className="text-rose-400 font-bold">{volume}%</span>
        </div>
        <Slider value={volume} min={0} max={100} step={1} onChange={setVolume} />
      </div>

      {/* Anime4K Preset */}
      <div>
        <span className="flex items-center gap-1.5 mb-2 font-medium text-slate-200">
          <Sparkles className="h-3.5 w-3.5 text-rose-500" />
          Пресет апскейлера Anime4K
        </span>
        <div className="grid grid-cols-2 gap-2">
          {SHADER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAnime4kPreset(p.id)}
              className={`rounded-xl px-3 py-2 text-left border transition-all cursor-pointer ${
                anime4kPreset === p.id
                  ? "border-rose-500 bg-rose-500/15 text-white font-semibold"
                  : "border-white/10 bg-white/[0.02] backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="space-y-3 pt-3 border-t border-white/10">
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="group-hover:text-white transition-colors">
            Автопропуск опенингов и эндингов
          </span>
          <input
            type="checkbox"
            checked={autoSkipOpEd}
            onChange={(e) => setAutoSkipOpEd(e.target.checked)}
            className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="group-hover:text-white transition-colors">
            Автопереход к следующему эпизоду
          </span>
          <input
            type="checkbox"
            checked={autoplayNext}
            onChange={(e) => setAutoplayNext(e.target.checked)}
            className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
