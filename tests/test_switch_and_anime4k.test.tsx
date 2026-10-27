import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Anime4kCanvas } from "@/features/player/ui/Anime4kCanvas";
import { SettingsMenu } from "@/features/player/ui/SettingsMenu";
import { Switch } from "../src/shared/ui/switch";

function ControlledSwitch() {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      checked={checked}
      onCheckedChange={setChecked}
      aria-label="Test Toggle"
      data-testid="test-switch"
    />
  );
}

describe("shadcn Switch Component", () => {
  it("renders correctly with unchecked state and role switch", () => {
    render(<ControlledSwitch />);
    const sw = screen.getByRole("switch");
    expect(sw).toBeDefined();
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(sw.getAttribute("data-state")).toBe("unchecked");
  });

  it("toggles state smoothly when clicked", () => {
    render(<ControlledSwitch />);
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(sw.getAttribute("data-state")).toBe("checked");

    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });
});

describe("Anime4kCanvas and SettingsMenu Switch Integration", () => {
  it("renders Switch components in SettingsMenu when opened", () => {
    render(<SettingsMenu currentQuality="1080p" onSelectQuality={() => {}} />);
    const trigger = screen.getByTitle("Настройки плеера");
    fireEvent.click(trigger);

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(3);

    // Upscaler toggle switch exists
    const upscalerSwitch = screen.getByLabelText("Переключить апскейлер 4K");
    expect(upscalerSwitch).toBeDefined();
  });

  it("renders Anime4kCanvas only when enabled", () => {
    const videoMock = { current: document.createElement("video") };
    const { container, rerender } = render(
      <Anime4kCanvas videoRef={videoMock} enabled={false} preset="mode-a" />,
    );
    expect(container.querySelector("canvas")).toBeNull();

    rerender(<Anime4kCanvas videoRef={videoMock} enabled={true} preset="mode-a" />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
