import { Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Switch } from "@/shared/ui/switch";
import { useEnhancement } from "../renderer/useEnhancement";
import { usePlayerStore } from "../state/playerStore";

/**
 * The gear menu (#72). Quality and speed moved to their own glass pickers on the bar, so this menu
 * carries the settings that are not timecode-level choices: the enhancement and the two autoplay
 * behaviours. Its states read as text and tone, and the panel over the frame is glass.
 */
export function SettingsMenu() {
  const { setAnime4kEnabled, autoSkipOpEd, setAutoSkipOpEd, autoplayNext, setAutoplayNext } =
    usePlayerStore();

  const { active, blocked, fault } = useEnhancement();
  const upscalerHint = blocked ?? fault ?? (active ? "Включен" : "Выключен");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger ariaLabel="Настройки плеера" title="Настройки плеера">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/10">
          <Settings className="h-5 w-5" />
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="right"
        className="w-64 space-y-1 bg-glass border-glass-line p-2 backdrop-blur-glass shadow-float"
      >
        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <div className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">Апскейлер 4K</span>
            <span className="mt-0.5 block text-[11px] text-ink-2">{upscalerHint}</span>
          </div>
          <Switch
            checked={active}
            disabled={blocked !== null}
            onCheckedChange={setAnime4kEnabled}
            aria-label="Переключить апскейлер 4K"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <div className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">Пропуск OP / ED</span>
          </div>
          <Switch
            checked={autoSkipOpEd}
            onCheckedChange={setAutoSkipOpEd}
            aria-label="Пропуск опенингов и эндингов"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <div className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">
              Автопереход к след. серии
            </span>
          </div>
          <Switch
            checked={autoplayNext}
            onCheckedChange={setAutoplayNext}
            aria-label="Автопереход к следующей серии"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
