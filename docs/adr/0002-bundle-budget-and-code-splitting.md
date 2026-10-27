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
  - initial entry chunk: **≤ 500 kB** — this is the budget the Vite warning enforces by default;
  - on-demand player chunk (`PlayerOverlay`): **≤ 1 MB**;
  - on-demand Anime4K chunk (`anime4kRenderer`): **≤ 3.6 MB**, accepted because it loads only after an explicit user action; it is the vendor floor of `anime4k-webgpu` 1.0.0.
- `build.chunkSizeWarningLimit` is set to the on-demand ceiling (3.6 MB) so the default build gate stays clean; the initial-budget half is enforced strictly by `tests/test_bundle_split.test.ts`, which builds the real artifact and asserts the entry chunk contains neither `hls.js` nor `anime4k-webgpu` signatures (and stays under 500 kB).

## Consequences

- Startup JS drops from ~4.45 MB to ~0.39 MB (114 kB gzipped); the player chunk is fetched while the user transitions into playback.
- Re-introducing a static player-UI import into the barrel or the shell turns `test_bundle_split.test.ts` red with a concrete artifact diff, so the boundary is regression-protected.
- Upgrading `anime4k-webgpu` should re-check the 3.6 MB ceiling; if a future version ships per-preset entry points, split per preset and lower the budget.
