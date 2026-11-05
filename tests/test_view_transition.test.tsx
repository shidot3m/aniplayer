import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewTransition } from "@/shared/lib/useViewTransition";

function stubMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  vi.restoreAllMocks();
});

describe("useViewTransition", () => {
  it("runs the action directly when the browser has no startViewTransition", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useViewTransition());
    const action = vi.fn();

    act(() => result.current(action));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("skips the transition and runs instantly under reduced motion", () => {
    stubMatchMedia(true);
    const startViewTransition = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = startViewTransition;

    const { result } = renderHook(() => useViewTransition());
    const action = vi.fn();

    act(() => result.current(action));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("defers the action into the startViewTransition callback when supported", () => {
    stubMatchMedia(false);
    let deferred: (() => void) | undefined;
    (document as { startViewTransition?: unknown }).startViewTransition = vi
      .fn()
      .mockImplementation((callback: () => void) => {
        deferred = callback;
        return { finished: Promise.resolve() };
      });

    const { result } = renderHook(() => useViewTransition());
    const action = vi.fn();

    act(() => result.current(action));

    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();

    act(() => deferred?.());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
