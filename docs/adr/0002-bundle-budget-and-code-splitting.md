# 2. Bundle budget and player-only code splitting

Date: 2026-10-27

Status: accepted, amended by [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md), by [ADR 0014](0014-webview-is-the-only-playback-backend.md), and by [ADR 0015](0015-anime4k-as-a-webgpu-renderer.md)

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

## Amendment (2026-11-02, [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md))

- `hls.js` and `anime4k-webgpu` left the dependency graph with the WebView player, so their per-library budgets and chunk-placement signatures no longer exist. The 3.6 MB Anime4K tier is gone — the shaders moved to the portable archive and mpv runs them.
- The rule this ADR keeps is the split itself: `LazyPlayerOverlay` stays lazy, and the initial JS budget (≤ 500 kB) is still enforced against the real production artifact by `tests/test_bundle_split.test.ts`.

## Amendment (2026-11-04, [ADR 0014](0014-webview-is-the-only-playback-backend.md))

- `hls.js` is back in the frontend graph as the WebView playback loader, and `anime4k-webgpu` is not: the mpv shader chain left the tree with [#60](https://github.com/shidot3m/aniplayer/issues/60), and the WebGPU renderer that would replace it is [#61](https://github.com/shidot3m/aniplayer/issues/61), whose tier this ADR does not set in advance.
- The split rule gains one level: `playbackSession` dynamic-imports `hls.js` when a session binds, so a static store import does not drag the loader into the entry chunk — the shape this ADR exists to prevent, now enforced inside the player feature rather than only at the barrel.
- Current tiers, measured 2026-11-04 on the real production artifact: entry `index-*.js` 378 kB (budget ≤ 500 kB), on-demand `PlayerOverlay-*.js` 29 kB plus `hls-*.js` 579 kB (combined budget ≤ 1 MB). `build.chunkSizeWarningLimit` is set to that 1 MB on-demand ceiling.
- `tests/test_bundle_split.test.ts` marks the loader by the `EXT-X-STREAM-INF` tag it parses: finding that tag in an entry chunk is the regression this amendment guards.

## Amendment (2026-11-04, [ADR 0015](0015-anime4k-as-a-webgpu-renderer.md))

- `anime4k-webgpu` is back, one level deeper than the player, exactly as this ADR first specified: `Anime4kCanvas` dynamic-imports `../renderer/anime4kRenderer` only when the enhancement is switched on, so opening the player without Anime4K still costs hls.js and not the shader tables.
- The Anime4K tier returns at its vendor floor, measured 2026-11-04 on the real production artifact: `anime4kRenderer-*.js` 3374 kB (budget ≤ 3600 kB), 957 kB gzipped. `build.chunkSizeWarningLimit` moves to that ceiling, which is why Vite stays quiet about the two accepted on-demand tiers.
- The on-demand player tier is unchanged (overlay 30 kB + `hls-*.js` 579 kB ≤ 1 MB) and is now measured with the renderer chunk excluded from the sum — the renderer is its own tier, not headroom.
- The guard identifies the renderer by a WGSL declaration (`texture_storage_2d<rgba16float, write>`) that only the shader tables carry, so it follows the code wherever the bundler names it, and fails if the tables reach the initial graph or outgrow the tier.
