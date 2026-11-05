import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The caption decision of [#64](https://github.com/shidot3m/aniplayer/issues/64) and
 * [ADR 0017](../docs/adr/0017-no-subtitle-control-the-catalog-delivers-no-text-track.md): the
 * catalog delivers no text track, so the app renders no caption track, so the two caption lints
 * cannot be satisfied by anything real. They are exempted for the one file that renders the media
 * element — in the lint policy, not in the source.
 *
 * Seam: the repository's lint policy (biome.jsonc, .aislop/config.yml) read against the source it
 * exempts. The exempted path is pinned literally rather than derived from the same scan that
 * finds the media elements, so a second media element arriving anywhere makes this test fail
 * instead of quietly widening the exemption: the gate holds, and the decision has to be taken
 * again on purpose.
 *
 * It catches a suppression creeping back into the source, a caption rule switched off for the
 * whole project, and an exemption naming a file that renders no media element. It misses whether
 * the catalog has started carrying text tracks: that is measured, not tested —
 * `docs/evidence/64/catalog_probe.py` and `cea608_probe.py` are the check ADR 0017 names as its
 * revisit trigger.
 */
const REPO_ROOT = resolve(import.meta.dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");
const BIOME_CONFIG = join(REPO_ROOT, "biome.jsonc");
const AISLOP_CONFIG = join(REPO_ROOT, ".aislop", "config.yml");
const SUPPRESSION = /(?:biome-ignore|aislop-ignore|eslint-disable)/;
const MEDIA_ELEMENT = /<(?:video|audio)(?![\w-])/;
const EXEMPTED = ["src/features/player/ui/PlayerVideoViewport.tsx"];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

/**
 * Prose talks about `<video>` all the time — in doc comments and in backticked code spans — and
 * none of that puts a media element on the page. Only markup does, so comments and code spans
 * leave the text before it is searched.
 */
function markupOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`[^`]*`/g, '""')
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The files that put a media element on the page: the ones the caption rules can bite. */
function mediaElementFiles(): string[] {
  return sourceFiles(SRC_DIR)
    .filter((file) => MEDIA_ELEMENT.test(markupOnly(readFileSync(file, "utf8"))))
    .map((file) => relative(REPO_ROOT, file).replace(/\\/g, "/"))
    .sort();
}

/**
 * Biome reads a `.jsonc` config with comments; this config keeps every comment on its own line,
 * which is what `bunx aislop fix` and `bunx biome check` leave it as, so dropping those lines is
 * enough to parse it.
 */
function biomeConfig(): Record<string, unknown> {
  const text = readFileSync(BIOME_CONFIG, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(text) as Record<string, unknown>;
}

interface BiomeRules {
  preset?: string;
  a11y?: Record<string, string>;
}

interface BiomeOverride {
  includes?: string[];
  linter?: { rules?: BiomeRules };
}

function biomeCaptionExemptions(config: Record<string, unknown>): string[] {
  const overrides = (config.overrides ?? []) as BiomeOverride[];
  return overrides
    .filter((entry) => entry.linter?.rules?.a11y?.useMediaCaption === "off")
    .flatMap((entry) => entry.includes ?? [])
    .map((glob) => glob.replace(/^\*\*\//, ""))
    .sort();
}

/** The `rules:` block at column 0 — what aislop applies to the whole project. */
function aislopGlobalRules(text: string): string {
  const start = text.search(/^rules:/m);
  if (start < 0) return "";
  const rest = text.slice(start + "rules:".length);
  const end = rest.search(/^\S/m);
  return end < 0 ? rest : rest.slice(0, end);
}

/** The file paths named by an `overrides:` entry that switches the caption rule off. */
function aislopCaptionExemptions(text: string): string[] {
  return [...text.matchAll(/files:\s*\[([^\]]*)\][\s\S]*?jsx-a11y\/media-has-caption:\s*off/g)]
    .flatMap((match) => match[1].split(","))
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .sort();
}

describe("the caption decision of ADR 0017", () => {
  it("names the media element the decision is about", () => {
    expect(mediaElementFiles()).toEqual(EXEMPTED);
  });

  it("keeps the exemption out of the source it exempts", () => {
    for (const file of sourceFiles(SRC_DIR)) {
      const found = SUPPRESSION.exec(readFileSync(file, "utf8"));
      expect(found, `${relative(REPO_ROOT, file)} carries ${found?.[0]}`).toBeNull();
    }
  });

  it("leaves both caption gates on for the rest of the project", () => {
    const config = biomeConfig();
    const globalRules = (config.linter as { rules?: BiomeRules } | undefined)?.rules;
    expect(globalRules?.preset, "Biome's recommended preset must stay in force").toBe(
      "recommended",
    );
    expect(globalRules?.a11y?.useMediaCaption).not.toBe("off");

    const aislop = readFileSync(AISLOP_CONFIG, "utf8");
    expect(aislopGlobalRules(aislop)).not.toMatch(/jsx-a11y\/media-has-caption:\s*off/);
  });

  it("exempts the caption rules for exactly the file the decision is about", () => {
    expect(biomeCaptionExemptions(biomeConfig())).toEqual(EXEMPTED);
    expect(aislopCaptionExemptions(readFileSync(AISLOP_CONFIG, "utf8"))).toEqual(EXEMPTED);
  });
});
