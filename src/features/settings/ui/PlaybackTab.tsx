import { ANIME4K_PRESETS, useEnhancement, usePlayerStore } from "@/features/player";
import type { VideoQuality } from "@/shared/types";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";

const QUALITY_OPTIONS: { id: VideoQuality; title: string; desc: string }[] = [
  { id: "1080p", title: "1080p (Full HD)", desc: "Максимальная чёткость" },
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
    <div className="space-y-6 text-sm text-ink-2">
      {/* Preferred Quality */}
      <div>
        <h3 className="mb-2.5 text-sm font-medium text-ink">Качество по умолчанию</h3>
        <div className="grid grid-cols-3 gap-2">
          {QUALITY_OPTIONS.map((opt) => {
            const selected = preferredQuality === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPreferredQuality(opt.id)}
                aria-pressed={selected}
                className={
                  selected
                    ? "cursor-pointer rounded-lg border border-accent bg-accent/10 p-2.5 text-left text-ink"
                    : "cursor-pointer rounded-lg border border-line p-2.5 text-left text-ink-2 transition-colors hover:border-ink/20 hover:text-ink"
                }
              >
                <span className="block text-[13px] font-medium">{opt.title}</span>
                <span className="mt-0.5 block text-[11px] text-ink-3">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Volume */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink">Громкость по умолчанию</h3>
          <span className="text-[13px] tabular-nums text-accent-ink">{volume}%</span>
        </div>
        <Slider
          value={volume}
          min={0}
          max={100}
          step={1}
          ariaLabel="Громкость по умолчанию"
          onChange={setVolume}
        />
      </div>

      {/* Anime4K Upscaler */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink">Апскейлер Anime4K</h3>
          <Switch
            checked={active}
            disabled={blocked !== null}
            onCheckedChange={setAnime4kEnabled}
            aria-label="Переключить апскейлер Anime4K"
          />
        </div>
        <p className="mb-3 text-[12px] text-ink-3">
          {blocked ??
            fault ??
            (active
              ? "Включен — кадр идёт через WebGPU-рендерер"
              : "Выключен — кадр идёт напрямую")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ANIME4K_PRESETS.map((p) => {
            const selected = anime4kPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnime4kPreset(p.id)}
                className={
                  selected
                    ? "cursor-pointer rounded-lg border border-accent bg-accent/10 p-2.5 text-left text-ink"
                    : "cursor-pointer rounded-lg border border-line p-2.5 text-left text-ink-2 transition-colors hover:border-ink/20 hover:text-ink"
                }
              >
                <span className="block text-[13px] font-medium leading-tight">{p.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">
                  {p.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Automation Toggles */}
      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">Автопропуск опенингов и эндингов</span>
          <Switch
            checked={autoSkipOpEd}
            onCheckedChange={setAutoSkipOpEd}
            aria-label="Автопропуск опенингов и эндингов"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">Автопереход к следующему эпизоду</span>
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
