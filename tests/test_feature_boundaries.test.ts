import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "../src");
const FEATURES_DIR = join(SRC_DIR, "features");

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function toSrcRelative(path: string): string {
  return relative(SRC_DIR, path).replace(/\\/g, "/");
}

function featureOf(absolutePath: string): string | null {
  const parts = toSrcRelative(absolutePath).split("/");
  return parts[0] === "features" ? (parts[1] ?? null) : null;
}

// Every quoted specifier that can pull in a module: static import/export
// "from", bare side-effect imports, and dynamic import()/require().
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*|\brequire\s*\()\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function specsOf(file: string): string[] {
  const specs: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
    specs.push(match[1] ?? match[2]);
  }
  return specs;
}

function featureTarget(
  spec: string,
  fromFile: string,
): { feature: string; subpath: string } | null {
  let normalized: string | null = null;
  if (spec.startsWith("@/features/")) normalized = spec.slice("@/".length);
  else if (spec.startsWith(".")) normalized = toSrcRelative(resolve(dirname(fromFile), spec));
  if (!normalized?.startsWith("features/")) return null;
  const parts = normalized.slice("features/".length).split("/");
  const feature = parts[0];
  if (!feature || !existsSync(join(FEATURES_DIR, feature))) return null;
  return { feature, subpath: parts.slice(1).join("/") };
}

describe("feature boundaries", () => {
  const violations: string[] = [];

  for (const file of listFiles(FEATURES_DIR)) {
    const owner = featureOf(file);
    if (!owner) continue;
    for (const spec of specsOf(file)) {
      const target = featureTarget(spec, file);
      if (!target || target.feature === owner) continue;
      const isPublicSurface = target.subpath === "";
      if (!isPublicSurface) {
        violations.push(`${file.slice(SRC_DIR.length + 1)} imports ${spec}`);
      }
    }
  }

  it("features import other features only through their index", () => {
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("code outside features reaches them only through their index", () => {
    const violations: string[] = [];
    for (const file of listFiles(SRC_DIR).filter((f) => !featureOf(f))) {
      for (const spec of specsOf(file)) {
        const target = featureTarget(spec, file);
        if (!target || target.subpath === "") continue;
        violations.push(`${toSrcRelative(file)} imports ${spec}`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every feature exposes an index barrel", () => {
    const missing = readdirSync(FEATURES_DIR)
      .filter((name) => statSync(join(FEATURES_DIR, name)).isDirectory())
      .filter((name) => !existsSync(join(FEATURES_DIR, name, "index.ts")))
      .join(", ");
    expect(missing).toBe("");
  });

  it("migrated features leave no stray files outside src/features", () => {
    const strays = [
      "store",
      "components/DownloadsView.tsx",
      "components/DownloadFloatingWidget.tsx",
      "components/BookmarksView.tsx",
      "components/SettingsDialog.tsx",
      "components/settings",
    ].filter((p) => existsSync(join(SRC_DIR, p)));
    expect(strays, strays.join(", ")).toEqual([]);
  });
});
