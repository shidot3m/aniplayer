import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Seam A (bundle-split contract): player-only libraries must not ship in the
// initial JavaScript load. Verified against the real build artifact: the entry
// chunk (the module script referenced by index.html) must not contain these
// signatures, and at least one non-entry chunk must.
// Signatures are string literals that survive minification.
const HLS_SIGNATURE = "FRAG_LOADING_WAITING_RETRY";
const ANIME4K_SIGNATURE = "Denoise Bilateral Mean Compute Pipeline";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = "dist-bundle-split-test";

interface Chunk {
  name: string;
  code: string;
}

function listChunks(dir: string): Chunk[] {
  const outDir = join(dir, "assets");
  return readdirSync(outDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({ name: f, code: readFileSync(join(outDir, f), "utf8") }));
}

function findEntryName(dir: string): string {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const match = html.match(/<script type="module"[^>]*src="[^"]*\/([^"]+\.js)"/);
  if (!match?.[1]) throw new Error("No module script entry found in index.html");
  return match[1];
}

describe("bundle split", () => {
  let chunks: Chunk[] = [];
  let entryName = "";

  beforeAll(async () => {
    // Vitest pins NODE_ENV=test, which would select the development React
    // build; contract the artifact under the same conditions as `vite build`.
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
    chunks = listChunks(join(REPO_ROOT, OUT_DIR));
    entryName = findEntryName(join(REPO_ROOT, OUT_DIR));
  }, 120_000);

  afterAll(() => {
    rmSync(join(REPO_ROOT, OUT_DIR), { recursive: true, force: true });
  });

  function entryChunk(): Chunk {
    const entry = chunks.find((c) => c.name === entryName);
    if (!entry) throw new Error(`Entry chunk ${entryName} not found in build output`);
    return entry;
  }

  it("initial entry chunk does not contain hls.js", () => {
    expect(entryChunk().code).not.toContain(HLS_SIGNATURE);
  });

  it("initial entry chunk does not contain anime4k-webgpu", () => {
    expect(entryChunk().code).not.toContain(ANIME4K_SIGNATURE);
  });

  it("hls.js is still built into a lazily loaded chunk", () => {
    const lazy = chunks.filter((c) => c.name !== entryName && c.code.includes(HLS_SIGNATURE));
    expect(lazy.length).toBeGreaterThan(0);
  });

  it("anime4k-webgpu is still built into a lazily loaded chunk", () => {
    const lazy = chunks.filter((c) => c.name !== entryName && c.code.includes(ANIME4K_SIGNATURE));
    expect(lazy.length).toBeGreaterThan(0);
  });

  // Budget from docs/adr/0002-bundle-budget-and-code-splitting.md.
  it("initial entry chunk stays within the 500 kB budget", () => {
    const sizeKb = Buffer.byteLength(entryChunk().code, "utf8") / 1024;
    expect(sizeKb).toBeLessThanOrEqual(500);
  });
});
