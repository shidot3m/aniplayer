import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENTRY_BUDGET_KB = 500;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = "dist-bundle-split-test";

interface Chunk {
  name: string;
  code: string;
  sizeKb: number;
}

function listChunks(dir: string): Chunk[] {
  const assets = join(dir, "assets");
  return readdirSync(assets)
    .filter((file) => file.endsWith(".js"))
    .map((file) => {
      const code = readFileSync(join(assets, file), "utf8");
      return { name: file, code, sizeKb: Buffer.byteLength(code, "utf8") / 1024 };
    });
}

function initialChunks(dir: string): string[] {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const names = [...html.matchAll(/<script type="module"[^>]*src="[^"]*\/([^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  if (names.length === 0) throw new Error("No module script entries found in index.html");
  return names;
}

describe("bundle split", () => {
  let chunks: Chunk[] = [];
  let initialNames: string[] = [];

  beforeAll(async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await build({
        root: REPO_ROOT,
        mode: "production",
        configFile: join(REPO_ROOT, "vite.config.ts"),
        logLevel: "silent",
        build: { outDir: OUT_DIR, emptyOutDir: true },
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
    const out = join(REPO_ROOT, OUT_DIR);
    chunks = listChunks(out);
    initialNames = initialChunks(out);
  }, 120_000);

  afterAll(() => {
    rmSync(join(REPO_ROOT, OUT_DIR), { recursive: true, force: true });
  });

  it("chunks loaded by index.html together stay within the 500 kB initial budget", () => {
    const initial = chunks.filter((chunk) => initialNames.includes(chunk.name));
    expect(initial.length).toBe(initialNames.length);
    expect(initial.reduce((sum, chunk) => sum + chunk.sizeKb, 0)).toBeLessThanOrEqual(
      ENTRY_BUDGET_KB,
    );
  });

  it("keeps the player overlay out of the initial JavaScript load", () => {
    expect(chunks.some((chunk) => !initialNames.includes(chunk.name))).toBe(true);
    for (const name of initialNames) {
      expect(chunks.find((chunk) => chunk.name === name)?.code).not.toContain("player-event");
    }
  });
});
