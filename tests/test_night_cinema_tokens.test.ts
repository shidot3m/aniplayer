import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The token seam of [#68](https://github.com/shidot3m/aniplayer/issues/68), the first delivery
 * wave of [ADR 0018](../docs/adr/0018-night-cinema-design-system.md): `src/index.css` is the single
 * source of the night cinema design decisions, and every screen reads them and nothing else.
 *
 * Seam: the stylesheet's `@theme` block read as text, the way `tests/test_bundle_split.test.ts`
 * reads build output. The values below are copied from the ticket and from the approved mockup
 * (`docs/design/night-cinema-mockup.html`), not from the file under test, so the assertion is
 * independent of the implementation it checks.
 *
 * It catches a token value drifting away from the approved palette, the stock rose palette
 * (Tailwind's own `rose`/`slate` ramp) being reintroduced as a theme variable, glass or motion
 * values being written into a component instead of the theme. It misses whether the palette looks
 * right: the mockup, the screenshots in `docs/evidence/68/` and the `review-animations` pass are
 * the checks for that.
 */
const REPO_ROOT = resolve(import.meta.dirname, "..");
const CSS_PATH = "src/index.css";

/** The colour roles ADR 0018 fixes. Nothing outside this list may be a theme colour. */
const COLOR_ROLES = [
  "ground",
  "surface-1",
  "surface-2",
  "ink",
  "ink-2",
  "ink-3",
  "line",
  "accent",
  "accent-ink",
  "glass",
  "glass-line",
  "scrim",
];

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The declarations inside the `@theme` block, keyed by custom property name. */
function theme(): Map<string, string> {
  const css = readFileSync(resolve(REPO_ROOT, CSS_PATH), "utf8");
  const start = css.indexOf("@theme");
  if (start < 0) throw new Error(`${CSS_PATH} declares no @theme block`);
  const open = css.indexOf("{", start);
  if (open < 0) throw new Error(`${CSS_PATH} has an unterminated @theme block`);

  let depth = 0;
  let end = open;
  for (; end < css.length; end++) {
    if (css[end] === "{") depth++;
    else if (css[end] === "}" && --depth === 0) break;
  }
  if (end === css.length) throw new Error(`${CSS_PATH} has an unterminated @theme block`);

  const declarations = new Map<string, string>();
  for (const line of css.slice(open + 1, end).split("\n")) {
    const match = /^\s*(--[\w.-]*\*?)\s*:\s*(.+?);/.exec(line);
    if (match) declarations.set(match[1], normalize(match[2]));
  }
  return declarations;
}

function colorToken(name: string): string | undefined {
  return theme().get(`--color-${name}`);
}

describe("night cinema tokens", () => {
  it("fixes the black & white ramp roles in @theme", () => {
    const expected = {
      ground: "#101010",
      "surface-1": "#1A1A1A",
      "surface-2": "#232323",
      ink: "#F5F5F5",
      "ink-2": "#A6A6A6",
      "ink-3": "#6E6E6E",
      line: "rgba(245, 245, 245, 0.08)",
    };
    for (const [role, value] of Object.entries(expected)) {
      expect(colorToken(role), `--color-${role}`).toBe(normalize(value));
    }
  });

  it("fixes crimson as the accent and a lightened shade for accent text", () => {
    expect(colorToken("accent")).toBe(normalize("#A4133C"));
    expect(colorToken("accent-ink")).toBe(normalize("#E5487A"));
  });

  it("fixes glass as one set of variables", () => {
    const tokens = theme();
    expect(colorToken("glass")).toBe(normalize("rgba(26, 26, 26, 0.55)"));
    expect(colorToken("glass-line")).toBe(normalize("rgba(245, 245, 245, 0.16)"));
    expect(tokens.get("--blur-glass")).toBe("18px");
  });

  it("fixes the motion charter as tokens", () => {
    const tokens = theme();
    expect(tokens.get("--ease-out")).toBe(normalize("cubic-bezier(0.23, 1, 0.32, 1)"));
    expect(tokens.get("--duration-hover")).toBe("160ms");
    expect(tokens.get("--duration-screen-in")).toBe("250ms");
    expect(tokens.get("--duration-screen-out")).toBe("300ms");
    // A bare `transition` utility must inherit the charter, or every component names its own
    // curve again and the tokens stop being the source.
    expect(tokens.get("--default-transition-duration")).toBe("var(--duration-hover)");
    expect(tokens.get("--default-transition-timing-function")).toBe("var(--ease-out)");
  });

  it("leaves no stock palette behind in the theme", () => {
    const css = readFileSync(resolve(REPO_ROOT, CSS_PATH), "utf8");
    const declared = [...theme().keys()]
      .filter((name) => name.startsWith("--color-") && !name.includes("*"))
      .map((name) => name.slice("--color-".length));

    expect(declared.sort()).toEqual([...COLOR_ROLES].sort());
    expect(css).not.toMatch(/#e11d48/i);
  });

  it("switches the default colour palette off instead of overriding it", () => {
    // Without this, Tailwind's own rose/slate ramps stay reachable as `bg-rose-600` and the old
    // theme survives under a different name.
    expect(theme().get("--color-*")).toBe("initial");
  });
});

/**
 * The consequence ADR 0018 states for the code: `src/index.css` is the single source of design
 * tokens and downstream code references tokens only. `--color-*: initial` makes a stock palette
 * utility compile to nothing at all, so a leftover is invisible rather than rose — which is
 * exactly why the names are searched in the source instead of trusted to the build.
 */
const SRC_DIR = join(REPO_ROOT, "src");

/** Utility classes naming a colour the theme no longer defines, or carrying a literal colour. */
const STOCK_COLOR_FAMILIES =
  "rose|slate|gray|zinc|neutral|stone|taupe|mauve|olive|mist|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|white|black";
const OFF_TOKEN_COLOR = new RegExp(
  [
    // `bg-rose-600`, `hover:text-slate-400`, `ring-offset-black`, `border-white/10` … — any
    // utility token ending in a colour the theme switched off, whatever its prefix or variant.
    String.raw`\b[a-z][a-z]*(?:-[a-z]+)*-(?:` +
      STOCK_COLOR_FAMILIES +
      String.raw`)(?:-[0-9]{2,3})?\b`,
    // `bg-[#12131A]`, `ring-offset-[#12131A]`, `border-[rgba(…)]` — a colour written into the markup.
    String.raw`\b[a-z][a-z]*(?:-[a-z]+)*-\[#`,
    // `fill="#E11D48"` — an SVG shape painted outside the theme.
    String.raw`\b(?:fill|stroke)="#`,
  ].join("|"),
);

/** Doc comments and line comments talk about the old palette all the time; only markup applies. */
function markupOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

function offTokenColors(): string[] {
  const findings: string[] = [];
  for (const file of [...sourceFiles(SRC_DIR), join(REPO_ROOT, "index.html")]) {
    const lines = markupOnly(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      const match = OFF_TOKEN_COLOR.exec(line);
      if (match) {
        const path = relative(REPO_ROOT, file).replace(/\\/g, "/");
        findings.push(`${path}:${index + 1}  ${match[0]}`);
      }
    });
  }
  return findings;
}

describe("the interface reads tokens only", () => {
  it("names no colour the theme does not define", () => {
    expect(offTokenColors()).toEqual([]);
  });
});
