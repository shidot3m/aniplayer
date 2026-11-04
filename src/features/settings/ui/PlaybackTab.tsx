import { Sparkles, Tv, Volume2 } from "lucide-react";
import { ANIME4K_PRESETS, useEnhancement, usePlayerStore } from "@/features/player";
import type { VideoQuality } from "@/shared/types";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";

const QUALITY_OPTIONS: { id: VideoQuality; title: string; desc: string }[] = [
  { id: "1080p", title: "1080p (Full HD)", desc: "Максимальная четкость" },
  { id: "720p", title: "720p (HD)", desc: "Баланс качества и трафика" },
  { id: "480p", title: "480p (SD)", desc: "Экономия трафика" },
];

export function PlaybackTab() {
  const {
    volume,
    setVolume,
    preferredQuality,
    setPreferredQuality,
    anime4kPreset,
    setAnime4kPreset,
    setAnime4kEnabled,
    autoSkipOpEd,
    setAutoSkipOpEd,
    autoplayNext,
    setAutoplayNext,
  } = usePlayerStore();

  const { active, blocked, fault } = useEnhancement();

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

      {/* Anime4K Upscaler */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
            Апскейлер Anime4K
          </span>
          <Switch
            checked={active}
            disabled={blocked !== null}
            onCheckedChange={setAnime4kEnabled}
            aria-label="Переключить апскейлер Anime4K"
          />
        </div>
        <div className="text-[11px] text-slate-400 mb-2.5">
          {blocked ??
            fault ??
            (active
              ? "Включен (кадр идёт через WebGPU-рендерер)"
              : "Выключен (кадр идёт напрямую)")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANIME4K_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={anime4kPreset === p.id}
              onClick={() => setAnime4kPreset(p.id)}
              className={`rounded-xl p-2.5 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                anime4kPreset === p.id
                  ? "border-rose-500 bg-rose-500/15 text-white shadow-xs ring-1 ring-rose-500/30"
                  : "border-white/10 bg-white/[0.02] backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className="font-bold text-[11px] text-white leading-tight mb-1">{p.label}</span>
              <p className="text-[10px] text-slate-400 leading-snug">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="space-y-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Автопропуск опенингов и эндингов</span>
          <Switch
            checked={autoSkipOpEd}
            onCheckedChange={setAutoSkipOpEd}
            aria-label="Автопропуск опенингов и эндингов"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-300">Автопереход к следующему эпизоду</span>
          <Switch
            checked={autoplayNext}
            onCheckedChange={setAutoplayNext}
            aria-label="Автопереход к следующему эпизоду"
          />
        </div>
      </div>
    </div>
  );
}
