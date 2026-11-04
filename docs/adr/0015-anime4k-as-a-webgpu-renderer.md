# 15. Anime4K runs as a WebGPU renderer over the media element

Date: 2026-11-04

Status: accepted ([#61](https://github.com/shidot3m/aniplayer/issues/61))

Implements the renderer [ADR 0014](0014-webview-is-the-only-playback-backend.md) planned and [ADR 0010](0010-mpv-subprocess-as-the-only-playback-backend.md) left behind, and adds a tier to [ADR 0002](0002-bundle-budget-and-code-splitting.md).

## Context

With the torrents gone ([ADR 0013](0013-hls-only-delivery-drops-bittorrent.md)) the catalog ceiling is 1080p H.264, so the enhancement is the only way a frame gets better than the source. It used to be a chain of GLSL shaders handed to mpv, and that backend no longer exists: the WebView is the player, and the only frame available is the one the `<video>` element presents inside the webview.

Anything else would undo the swap. A native renderer (mpv, libplacebo, a GPU subprocess) means shipping a media runtime again — the ~100 MB and the window stack [ADR 0014] deleted. Porting the mpv dialect (`//!HOOK`, `//!BIND`, `//!SAVE`, `//!WHEN`, RPN conditions) to WebGL2 ping-pong framebuffers means owning a second shader compiler, with the CNN weights re-embedded by hand.

That leaves the browser-side option: `anime4k-webgpu`, an npm port of the Anime4K models to WebGPU compute shaders.

## Decision

- **`anime4k-webgpu@1.0.0` is the pipeline, pinned exactly.** Pinned rather than ranged because the package is not maintained: 1.0.0 published 2024-06-07, nothing since, one maintainer. A caret range would silently accept an unreviewed release from a package nobody is watching. Its `LICENSE.md` is MIT, and the archive is a frontend bundle, so nothing is redistributed besides the app's own JavaScript.
- **It is not official Anime4K, and the project knows.** The package is a University of Pennsylvania CIS 565 GPU-programming final project (Anime4KWebBoost) that ports bloc97's models and references the upstream repository; it is not released or endorsed by the Anime4K project. Its README lists work it never finished, and nothing in it is tested against the upstream GLSL output. The accepted risk is that the enhancement's fidelity is whatever this port does, and that no upstream fix will ever arrive. There is no maintained browser-side Anime4K to prefer: upstream ships GLSL for mpv and nothing else.
- **The app owns the frame loop, not the package.** The package exports `render({ video, canvas, pipelineBuilder })`, which resolves once it has scheduled a `requestVideoFrameCallback` loop it never returns a handle to — switching the enhancement off would leave that loop drawing forever, holding a `GPUDevice` and its textures. `src/features/player/renderer/anime4kRenderer.ts` therefore uses the pipeline classes directly: it copies the presented frame into its own input texture, calls `pipeline.pass(encoder)`, blits the pipeline's output texture to the canvas, and can be stopped and rebuilt.
- **Six presets, because the package exports exactly six preset pipelines** — ModeA, ModeAA, ModeB, ModeBB, ModeC, ModeCA. The seventh entry Settings used to offer, `Mode Fast (APU)`, named a pipeline that never existed and aliased to Mode A, and the hotkey table could write `Mode A (Fast)` and `Off`, which matched nothing either. A stored value that is not one of the six now resolves to the default, so no preference can name a filter the renderer cannot build.
- **Synchronization is the element's, not the renderer's.** Drawing is driven by `requestVideoFrameCallback`, so a frame is filtered when the media stack presents it; audio stays on the element's own clock and the element keeps decoding while the canvas paints over it (`opacity-0`, never `display:none`). Seek and pause need no special handling — the presented frame after a `seeked` simply redraws.
- **No WebGPU is a explained refusal, not a broken frame.** `useEnhancement` is the one verdict the player menu, the Settings tab, the badge and the playback surface share: without `navigator.gpu` the control is disabled with the reason in its place, and a renderer that fails after the switch is on reports the reason and leaves the element visible. The canvas is never mounted over a frame it cannot paint. A refused renderer does not disable the control: switching off and on drops the recorded reason and asks the GPU again, because one refusal — a driver that was not ready — must not cost the feature for the session. The live pass found the first version of this rule locking the switch.
- **The renderer is lazy, and the guard makes that a contract.** `Anime4kCanvas` dynamic-imports the renderer, so the ~3.4 MB of WGSL shader tables is fetched only when the enhancement is switched on. `tests/test_bundle_split.test.ts` marks the chunk by a WGSL declaration only those tables carry, fails if it appears in the initial graph, and enforces its tier ([ADR 0002] amended).

## Considered options

- **WebGL2 port of the upstream GLSL shaders** — rejected: a second shader dialect to own, with the CNN weight tables re-derived by hand and no way to check the result against mpv's output.
- **Keep the mpv shader chain and only swap the decoder** — rejected with the rest of [ADR 0010]: it is the media runtime and the window stack the swap deleted.
- **Use the package's `render()` wrapper** — rejected: it cannot be stopped, so it cannot survive a toggle, a preset change, or an Episode switch, which is the whole interface this feature has.
- **Wait for a maintained WebGPU Anime4K** — rejected: none exists, and a feature that is the reason users open the app does not stay a stored preference.

## Consequences

- WebGPU becomes a hardware requirement for one feature and for nothing else: the app plays, seeks, switches Quality and downloads normally on a machine without it, and only the upscale is out of order.
- An upgrade of the pin re-measures the bundle tier, and a package that ever ships per-preset entry points should be split per preset and the budget lowered — the instruction [ADR 0002] already carries.
- `@webgpu/types` is a devDependency: the package's own declarations reference it, and the app's renderer is typed against the same GPU surface.
- Three hedges cover the unmaintained dependency: the exact pin and lockfile, the guard test that fails when the chunk moves or grows, and the fallback path that cannot leave a black canvas over a live Episode.

[ADR 0002]: 0002-bundle-budget-and-code-splitting.md
[ADR 0010]: 0010-mpv-subprocess-as-the-only-playback-backend.md
[ADR 0013]: 0013-hls-only-delivery-drops-bittorrent.md
[ADR 0014]: 0014-webview-is-the-only-playback-backend.md
