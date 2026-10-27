# 2. Bundle budget and player-only code splitting

Date: 2026-10-27

Status: accepted

## Context

The Tauri shell loads `dist/index.html` on startup, so the initial JavaScript chunk is on the critical path of every launch. Before the split the entry chunk was ~4.45 MB minified because `App.tsx` imported the whole player barrel statically, pulling `hls.js` (~0.6 MB) and `anime4k-webgpu` (~3.4 MB, mostly precompiled CNN/WGS shader tables) into the initial load even when the user never opened the player. Vite warned about chunks larger than 500 kB.

Splitting these libraries further than "on demand" is not possible: each ships as one monolithic package with no subpath entries, and their size is data (shader tables, error catalogs), not dead code.

## Decision

- Player-only libraries load lazily. `src/features/player/index.ts` exposes `LazyPlayerOverlay` created with `React.lazy`; the barrel must never statically re-export `PlayerOverlay` or anything that transitively imports `hls.js`. The application shell renders it inside a `<Suspense>` boundary.
- `anime4k-webgpu` is split one level deeper: `Anime4kCanvas` dynamic-imports `../renderer/anime4kRenderer` only when the enhancement is switched on, so opening the player without Anime4K costs ~0.6 MB (hls.js), not ~4 MB.
- Explicit bundle budget (minified sizes):
  - JavaScript reachable from `index.html` at startup: **≤ 500 kB** (measured: ~386 kB entry + ~0.6 kB runtime);
  - on-demand player chunk (`PlayerOverlay`, hls.js): **≤ 1 MB**;
  - on-demand Anime4K chunk (`anime4kRenderer`): **≤ 3.6 MB**, accepted because it loads only after an explicit user action; it is the vendor floor of `anime4k-webgpu` 1.0.0.
- Every tier of the budget is enforced by `tests/test_bundle_split.test.ts`, which builds the real production artifact and asserts per-library chunk placement and sizes. `build.chunkSizeWarningLimit` is raised to the on-demand ceiling (3.6 MB) only so the default Vite gate stays clean for the two accepted on-demand chunks; it is not the initial-budget enforcement.

## Consequences

- Startup JS drops from ~4.45 MB to ~387 kB minified (115 kB gzipped for the
  entry chunk); the player chunk is fetched while the user transitions into
  playback, behind a shell-with-spinner `Suspense` fallback.
- Re-introducing a static player-UI import into the barrel or the shell turns `test_bundle_split.test.ts` red with a concrete artifact diff, so the boundary is regression-protected.
- Upgrading `anime4k-webgpu` should re-check the 3.6 MB ceiling; if a future version ships per-preset entry points, split per preset and lower the budget.
