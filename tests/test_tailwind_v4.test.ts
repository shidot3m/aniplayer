import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..");

function read(file: string): string {
  return readFileSync(join(REPO_ROOT, file), "utf8");
}

describe("Tailwind 4 migration", () => {
  it("imports Tailwind through CSS instead of legacy directives", () => {
    const css = read("src/index.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("registers the Tailwind plugin in Vite without PostCSS tooling", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
    expect(pkg.devDependencies["@tailwindcss/vite"]).toMatch(/^\^?4\./);
    expect(pkg.devDependencies).not.toHaveProperty("autoprefixer");
    expect(pkg.devDependencies).not.toHaveProperty("postcss");

    expect(read("vite.config.ts")).toMatch(/tailwindcss\(\)/);
  });

  it("removes the legacy Tailwind and PostCSS config files", () => {
    for (const file of [
      "tailwind.config.js",
      "tailwind.config.ts",
      "postcss.config.js",
      "postcss.config.mjs",
    ]) {
      expect(existsSync(join(REPO_ROOT, file))).toBe(false);
    }
  });

  it("keeps the v3 palette and line-heights for visual parity", () => {
    const css = read("src/index.css");
    expect(css).toContain("--color-rose-600: #e11d48;");
    expect(css).toContain("--text-xs--line-height: 1rem;");
  });
});
