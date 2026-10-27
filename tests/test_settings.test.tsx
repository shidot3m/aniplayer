import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "@/features/player";
import { SettingsDialog } from "../src/components/SettingsDialog";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("SettingsDialog & PlayerStore Settings", () => {
  it("renders playback and hotkeys tabs and toggles between them", () => {
    render(<SettingsDialog isOpen={true} onClose={() => {}} />);

    // Check tabs
    const playbackTab = screen.getByText("Воспроизведение");
    const hotkeysTab = screen.getByText("Горячие клавиши");
    expect(playbackTab).toBeDefined();
    expect(hotkeysTab).toBeDefined();

    // In playback tab: preferred quality options exist
    expect(screen.getByText("1080p (Full HD)")).toBeDefined();
    expect(screen.getByText("720p (HD)")).toBeDefined();
    expect(screen.getByText("480p (SD)")).toBeDefined();

    // Select 720p
    fireEvent.click(screen.getByText("720p (HD)"));
    expect(usePlayerStore.getState().preferredQuality).toBe("720p");

    // Switch to hotkeys tab
    fireEvent.click(hotkeysTab);
    expect(screen.getByText("Воспроизведение / Пауза")).toBeDefined();
    expect(screen.getByText("Полноэкранный режим")).toBeDefined();
    expect(screen.getByText("Пропуск OP / ED")).toBeDefined();
    expect(screen.getByText("Сбросить")).toBeDefined();
  });

  it("allows customizing hotkeys and resetting to defaults", async () => {
    const store = usePlayerStore.getState();
    await store.setHotkey("togglePlay", "KeyX");
    expect(usePlayerStore.getState().hotkeys.togglePlay).toBe("KeyX");

    await store.resetHotkeys();
    expect(usePlayerStore.getState().hotkeys.togglePlay).toBe("Space");
  });
});
