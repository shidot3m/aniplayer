import { useCallback } from "react";
import { flushSync } from "react-dom";

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/**
 * A hand-rolled wrapper over `document.startViewTransition` (ADR 0018 — not `react@canary`'s
 * `<ViewTransition>`). It runs a navigation update so the browser can morph a shared element —
 * the catalog poster into the Release key art — across the screen change.
 *
 * The caller mutates navigation state inside `action`; `flushSync` forces React to paint the new
 * DOM within the transition callback so the two snapshots exist. Where the API is missing, or the
 * viewer asked for reduced motion, the action runs directly and the screen changes instantly.
 */
export function useViewTransition() {
  return useCallback((action: () => void) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      action();
      return;
    }

    const doc = document as TransitionDocument;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (typeof doc.startViewTransition !== "function" || reduced) {
      action();
      return;
    }

    doc.startViewTransition(() => {
      flushSync(action);
    });
  }, []);
}
