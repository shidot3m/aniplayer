import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..");

function read(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

describe("Tailwind 4 migration", () => {
  it("imports Tailwind through CSS instead of legacy directives", () => {
    const css = read(REPO_ROOT, "src/index.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("uses the v4 Vite plugin without PostCSS tooling", () => {
    const pkg = JSON.parse(read(REPO_ROOT, "package.json")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
    expect(pkg.devDependencies["@tailwindcss/vite"]).toMatch(/^\^?4\./);
    expect(pkg.devDependencies).not.toHaveProperty("autoprefixer");
    expect(pkg.devDependencies).not.toHaveProperty("postcss");
  });

  it("removes the legacy Tailwind and PostCSS config files", () => {
    expect(existsSync(join(REPO_ROOT, "tailwind.config.js"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "postcss.config.js"))).toBe(false);
  });
});
