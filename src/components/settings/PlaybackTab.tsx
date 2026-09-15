import { Sparkles, Tv, Volume2 } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { VideoQuality } from "../../types";
import { Slider } from "../ui/slider";

const QUALITY_OPTIONS: { id: VideoQuality; title: string; desc: string }[] = [
  { id: "1080p", title: "1080p (Full HD)", desc: "Максимальная четкость" },
  { id: "720p", title: "720p (HD)", desc: "Баланс качества и трафика" },
  { id: "480p", title: "480p (SD)", desc: "Экономия трафика" },
];

import { ANIME4K_PRESETS } from "../../store/playerStoreDefaults";


export function PlaybackTab() {
  const {
    volume,
    setVolume,
    preferredQuality,
    setPreferredQuality,
    anime4kPreset,
    setAnime4kPreset,
    anime4kEnabled,
    toggleAnime4k,
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

      {/* Anime4K Upscaler */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
            Апскейлер Anime4K
          </span>
          <button
            type="button"
            role="switch"
            aria-label="Переключить апскейлер Anime4K"
            aria-checked={anime4kEnabled}
            onClick={toggleAnime4k}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              anime4kEnabled ? "bg-rose-600" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                anime4kEnabled ? "translate-x-4.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="text-[11px] text-slate-400 mb-2.5">
          {anime4kEnabled ? "Включен (активен выбранный шейдер)" : "Выключен"}
        </div>
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-2 transition-opacity duration-200 ${
            anime4kEnabled ? "opacity-100" : "opacity-40 pointer-events-none"
          }`}
        >
          {ANIME4K_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!anime4kEnabled}
              onClick={() => setAnime4kPreset(p.id)}
              className={`rounded-xl p-2.5 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                anime4kPreset === p.id
                  ? "border-rose-500 bg-rose-500/15 text-white shadow-sm ring-1 ring-rose-500/30"
                  : "border-white/10 bg-white/[0.02] backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="font-bold text-[11px] text-white leading-tight">{p.label}</span>
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md ${
                    p.tier === "Fast"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {p.tier}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">{p.description}</p>
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
