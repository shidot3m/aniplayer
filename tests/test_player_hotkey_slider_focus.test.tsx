import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePlayerHotkeys } from "@/features/player/hooks/usePlayerHotkeys";
import { SeekBar } from "@/features/player/ui/SeekBar";
import { formatTime } from "@/shared/lib/utils";
import { Slider } from "@/shared/ui/slider";

const DURATION = 1440;
const START = 100;

interface HarnessProps {
  currentTime: number;
  volume: number;
  seekRelative: (offset: number) => void;
  setVolume: (vol: number) => void;
}

function PlayerHarness({ currentTime, volume, seekRelative, setVolume }: HarnessProps) {
  usePlayerHotkeys({
    onUserActivity: () => {},
    togglePlay: () => {},
    seekRelative,
    seekTo: () => {},
    setVolume,
    volume,
    toggleMute: () => {},
    toggleFullscreen: () => {},
    isInsideOpening: false,
    isInsideEnding: false,
    onNext: () => {},
    onPrev: () => {},
    setAnime4kPreset: () => {},
    setAnime4kEnabled: () => {},
  });

  return (
    <div>
      <div data-testid="timecodes">{`${formatTime(currentTime)} / ${formatTime(DURATION)}`}</div>
      <SeekBar currentTime={currentTime} duration={DURATION} onSeek={() => {}} />
      <Slider value={volume} min={0} max={100} step={1} ariaLabel="Громкость" onChange={() => {}} />
      <input aria-label="Поиск" type="text" />
    </div>
  );
}

function SpyHarness({ seekRelative }: { seekRelative: (offset: number) => void }) {
  return (
    <PlayerHarness
      currentTime={START}
      volume={40}
      seekRelative={seekRelative}
      setVolume={() => {}}
    />
  );
}

/** The position is state the hotkey moves, so the slider and the label can be read back. */
function LiveHarness() {
  const [currentTime, setCurrentTime] = useState(START);
  const [volume] = useState(40);
  return (
    <PlayerHarness
      currentTime={currentTime}
      volume={volume}
      setVolume={() => {}}
      seekRelative={(offset) => setCurrentTime((t) => Math.min(DURATION, Math.max(0, t + offset)))}
    />
  );
}

function seekBarInput(): HTMLInputElement {
  return screen.getByLabelText("Шкала времени") as HTMLInputElement;
}

describe("Player hotkeys while a slider has focus", () => {
  it("seeks +5 s on ArrowRight pressed on the focused seek bar, cancelling the slider's own step", () => {
    const seekRelative = vi.fn();
    render(<SpyHarness seekRelative={seekRelative} />);
    const seekBar = seekBarInput();

    seekBar.focus();
    const defaultActionRan = fireEvent.keyDown(seekBar, { code: "ArrowRight" });

    expect(seekRelative).toHaveBeenCalledWith(5);
    expect(defaultActionRan).toBe(false);
  });

  it("seeks -30 s on Shift+ArrowLeft pressed on the focused seek bar", () => {
    const seekRelative = vi.fn();
    render(<SpyHarness seekRelative={seekRelative} />);
    const seekBar = seekBarInput();

    seekBar.focus();
    fireEvent.keyDown(seekBar, { code: "ArrowLeft", shiftKey: true });

    expect(seekRelative).toHaveBeenCalledWith(-30);
  });

  it("seeks on arrow keys pressed on the focused volume slider", () => {
    const seekRelative = vi.fn();
    render(<SpyHarness seekRelative={seekRelative} />);
    const volumeSlider = screen.getByRole("slider", { name: "Громкость" });

    volumeSlider.focus();
    fireEvent.keyDown(volumeSlider, { code: "ArrowRight" });

    expect(seekRelative).toHaveBeenCalledWith(5);
  });

  it("keeps suppressing player hotkeys while a text field has focus", () => {
    const seekRelative = vi.fn();
    render(<SpyHarness seekRelative={seekRelative} />);
    const textField = screen.getByLabelText("Поиск");

    textField.focus();
    fireEvent.keyDown(textField, { code: "ArrowRight" });

    expect(seekRelative).not.toHaveBeenCalled();
  });

  it("moves the seek bar and the time label with the arrow key that seeked", () => {
    render(<LiveHarness />);
    const seekBar = seekBarInput();

    seekBar.focus();
    fireEvent.keyDown(seekBar, { code: "ArrowRight" });

    expect(seekBar.value).toBe("105");
    expect(screen.getByTestId("timecodes").textContent).toBe("01:45 / 24:00");
  });
});
