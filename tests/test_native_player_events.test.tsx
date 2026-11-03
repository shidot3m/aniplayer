import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNativePlayer } from "@/features/player/renderer/useNativePlayer";

const listener = vi.hoisted(() => ({
  callback: undefined as ((event: { payload: unknown }) => void) | undefined,
  unlisten: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_name, callback) => {
    listener.callback = callback;
    return Promise.resolve(listener.unlisten);
  }),
}));

function Harness({
  onTimeUpdate,
  onEnded,
  onFault,
}: {
  onTimeUpdate: (position: number, duration: number) => void;
  onEnded: () => void;
  onFault: (message: string) => void;
}) {
  useNativePlayer({ onTimeUpdate, onEnded, onFault });
  return null;
}

describe("native player events", () => {
  beforeEach(() => {
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
    listener.callback = undefined;
    listener.unlisten.mockClear();
  });

  it("turns mpv events into time, end-of-episode and fault behavior", async () => {
    const onTimeUpdate = vi.fn();
    const onEnded = vi.fn();
    const onFault = vi.fn();
    const { unmount } = render(
      <Harness onTimeUpdate={onTimeUpdate} onEnded={onEnded} onFault={onFault} />,
    );
    await act(async () => {});

    act(() => {
      listener.callback?.({
        payload: { type: "time", position: 42, duration: 1440 },
      });
      listener.callback?.({ payload: { type: "ended" } });
      listener.callback?.({ payload: { type: "fault", message: "decoder failed" } });
    });

    expect(onTimeUpdate).toHaveBeenCalledWith(42, 1440);
    expect(onEnded).toHaveBeenCalledOnce();
    expect(onFault).toHaveBeenCalledWith("decoder failed");

    unmount();
    await act(async () => {});
    expect(listener.unlisten).toHaveBeenCalledOnce();
  });
});
