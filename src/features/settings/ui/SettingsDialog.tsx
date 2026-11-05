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
        <DialogTitle>Настройки</DialogTitle>
      </DialogHeader>

      {/* Tabs Switcher */}
      <div className="mb-5 flex gap-6 border-b border-line">
        {(["playback", "hotkeys"] as const).map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                selected
                  ? "-mb-px cursor-pointer border-b-2 border-accent pb-2.5 text-sm font-medium text-ink"
                  : "-mb-px cursor-pointer border-b-2 border-transparent pb-2.5 text-sm text-ink-2 transition-colors hover:text-ink"
              }
            >
              {tab === "playback" ? "Воспроизведение" : "Горячие клавиши"}
            </button>
          );
        })}
      </div>

      {activeTab === "playback" ? <PlaybackTab /> : <HotkeysTab isOpen={isOpen} />}
    </Dialog>
  );
}
