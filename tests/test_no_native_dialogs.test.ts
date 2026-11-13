import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Issue #77: a native dialog (`window.alert`) is the only piece of the interface that lives
 * outside the React tree, and — like in a browser — it blocks the page's JavaScript until it is
 * dismissed, under a title («Сообщение с tauri.localhost») that reads as a browser error, not the
 * app's. Downloads report through the floating widget instead, so no such call may come back.
 *
 * Seam: the repository's own rule, pinned as a scan of `src/` for the forbidden call, not a
 * suppression the source can re-add. This mirrors `test_caption_policy.test.ts`: the gate is the
 * check, and reintroducing a native dialog fails the suite until the decision is taken again.
 */
const REPO_ROOT = resolve(import.meta.dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");

// A bare or `window.`-prefixed alert call. `\balert` is lowercase, so `AlertCircle`, `Alert` and
// the word inside prose cannot trip it; the `[\w.]` lookbehind rejects an identifier that merely
// ends in "alert" (`clearAlert(`) being read as the global.
const NATIVE_ALERT = /(^|[^.\w])(?:window\.)?alert\s*\(/;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

describe("no native dialogs in the UI", () => {
  it("src/ calls window.alert nowhere", () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((file) => NATIVE_ALERT.test(readFileSync(file, "utf8")))
      .map((file) => relative(REPO_ROOT, file).replace(/\\/g, "/"))
      .sort();

    expect(
      offenders,
      `native alert() must be replaced by the downloads widget: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
