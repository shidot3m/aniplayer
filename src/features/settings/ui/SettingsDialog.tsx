import { Keyboard, Sliders } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { HotkeysTab } from "./HotkeysTab";
import { PlaybackTab } from "./PlaybackTab";

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"playback" | "hotkeys">("playback");

  return (
    <Dialog isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span>Настройки</span>
        </DialogTitle>
      </DialogHeader>

      {/* Tabs Switcher */}
      <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab("playback")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeTab === "playback"
              ? "bg-rose-600 text-white shadow-xs font-semibold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Воспроизведение</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hotkeys")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeTab === "hotkeys"
              ? "bg-rose-600 text-white shadow-xs font-semibold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span>Горячие клавиши</span>
        </button>
      </div>

      {activeTab === "playback" ? <PlaybackTab /> : <HotkeysTab isOpen={isOpen} />}
    </Dialog>
  );
}
