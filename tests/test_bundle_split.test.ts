import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Seam A (bundle-split contract): player-only libraries must not ship in the
// initial JavaScript load, and per-chunk sizes must stay inside the budget in
// docs/adr/0002-bundle-budget-and-code-splitting.md. Verified against the real
// production build artifact. Signatures are string literals that survive
// minification.
const LIBRARIES = [
  { name: "hls.js", signature: "FRAG_LOADING_WAITING_RETRY", lazyBudgetKb: 1000 },
  {
    name: "anime4k-webgpu",
    signature: "Denoise Bilateral Mean Compute Pipeline",
    lazyBudgetKb: 3600,
  },
] as const;

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
    .filter((f) => f.endsWith(".js"))
    .map((f) => {
      const code = readFileSync(join(assets, f), "utf8");
      return { name: f, code, sizeKb: Buffer.byteLength(code, "utf8") / 1024 };
    });
}

function initialChunks(dir: string): string[] {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const names = [...html.matchAll(/<script type="module"[^>]*src="[^"]*\/([^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  if (names.length === 0) throw new Error("No module script entries found in index.html");
  return names;
}

describe("bundle split", () => {
  let chunks: Chunk[] = [];
  let initialNames: string[] = [];

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
    const out = join(REPO_ROOT, OUT_DIR);
    chunks = listChunks(out);
    initialNames = initialChunks(out);
  }, 120_000);

  afterAll(() => {
    rmSync(join(REPO_ROOT, OUT_DIR), { recursive: true, force: true });
  });

  function lazyChunksWith(signature: string): Chunk[] {
    return chunks.filter((c) => !initialNames.includes(c.name) && c.code.includes(signature));
  }

  it("chunks loaded by index.html together stay within the 500 kB initial budget", () => {
    const initial = chunks.filter((c) => initialNames.includes(c.name));
    expect(initial.length).toBe(initialNames.length);
    const totalKb = initial.reduce((sum, c) => sum + c.sizeKb, 0);
    expect(totalKb).toBeLessThanOrEqual(ENTRY_BUDGET_KB);
  });

  for (const lib of LIBRARIES) {
    it(`initial load does not contain ${lib.name}`, () => {
      for (const name of initialNames) {
        const chunk = chunks.find((c) => c.name === name);
        expect(chunk?.code ?? "").not.toContain(lib.signature);
      }
    });

    it(`${lib.name} is still built into a lazily loaded chunk`, () => {
      expect(lazyChunksWith(lib.signature).length).toBeGreaterThan(0);
    });

    it(`${lib.name} lazy chunk(s) stay within the documented budget`, () => {
      const totalKb = lazyChunksWith(lib.signature).reduce((sum, c) => sum + c.sizeKb, 0);
      expect(totalKb).toBeLessThanOrEqual(lib.lazyBudgetKb);
    });
  }
});
