# 11. Bun is the only JS toolchain

Date: 2026-11-03

Status: accepted

## Context

The frontend was installed and driven through npm on a Node runtime, which meant two JavaScript engines in the project's life: Node for `npm ci`, `npm run`, `npx`, and for hosting Vitest, and nothing else. Dependency installation, script execution, and the `tsc`/`vite`/`biome`/`vitest` tools all went through the registry client, and the lockfile (`package-lock.json`) pinned that arrangement.

Bun unifies all three roles — package manager, script runner, and runtime that the tooling executes on — with a single pinned binary. It reads the npm-semver ranges and the `overrides` block unchanged, produces a committed lockfile (`bun.lock`, lockfileVersion 2) with a hoisted `node_modules` layout, and is the current stable release of its own line (v1.4.4, the latest stable at the time of the switch). Measured on this repo before the decision was landed: the full Vitest suite — 21 files, 65 tests, `jsdom` environment — passes on Bun without any test changes, so no Node hybrid is needed to keep the tests alive.

## Decision

- **Bun replaces npm everywhere in the project**: dependency installation, script running, and ad-hoc tool invocation (`bun install`, `bun run <script>`, `bunx <tool>`). No npm or npx call survives in the repo's scripts or workflows, and the Node runtime is never executed — Node survives only as ambient type declarations (`@types/node`), which Bun's runtime consumes. The README names Bun 1.4.4 as the only JS requirement.
- **The version is pinned through `"packageManager": "bun@1.4.4"` in `package.json`.** CI installs Bun with `oven-sh/setup-bun@v2.2.0`, which reads the version from that field; `actions/setup-node` is gone from the frontend job.
- **`bun.lock` is the only lockfile.** `package-lock.json` is deleted; `bunfig.toml` pins the `hoisted` install linker so the `node_modules` layout — which Tauri's `before*Command` hooks and the Rust build read — stays flat and predictable.
- **All in-repo entry points go through Bun**: the `check` script chains `bun run`/`bunx`, `src-tauri/tauri.conf.json` runs `beforeDevCommand`/`beforeBuildCommand` through `bun run`, and the Windows helper scripts (`scripts/tauri-win.cmd`, `scripts/msvc-cmd.cmd`) and packaging scripts call `bun run tauri` / `bunx tauri`.
- **A mechanical guard rejects regression**: a CI step fails when an npm- or npx-spelled command string appears in `.github/workflows/` or `scripts/` (the pattern is deliberately obfuscated so the guard never matches its own source). The rule is enforced by the pipeline, not by review memory.
- **Incompatibilities are diagnosed, not routed around.** If a tool fails under the Bun runtime, the root cause is found and fixed (or reported upstream); the forbidden shortcut is handing the failing part back to Node — a hybrid toolchain would keep both engines and double the support surface.

## Considered options

- **Stay on npm/Node** — rejected: it keeps two runtimes where the project needs one, and installs and script execution were the reason for the switch; the only Node-specific surface left is ambient type declarations, which any runtime consumes.
- **pnpm or yarn as the replacement** — rejected: they replace only the registry client; the scripts, `bunx`-equivalent tool invocation, and the runtime hosting the tests would still need Node, so the two-engine split survives.
- **jsdom tests moved to Bun's native DOM (`happy-dom`/`dom`)** — held in reserve, not needed: `vitest`+`jsdom` measured green on Bun 1.4.4, so the environment stays `jsdom` and the test config is untouched.

## Consequences

- Developers install Bun (1.4.4, matching `packageManager`); Node and npm are no longer required for anything in this repo.
- Dependabot-style range bumps resolve through `bun install` and land in `bun.lock`; the semver ranges in `package.json` keep their meaning, and the new lock carries fresh resolutions inside those ranges (e.g. `tslib` 2.8.1 → 2.9.1, `lightningcss` now also resolved at 1.33.0 where its range admits it). `bun.lock` must be updated in the same commit as any `package.json` edit.
- Tooling now executes on the Bun runtime, so future runtime-level breakage (Node-API behavior, globals, ESM edge cases) must be diagnosed as Bun incompatibility at the source — the guard and this ADR forbid the Node fallback as an answer.
- CI installs dependencies from the lockfile with `bun install --frozen-lockfile`. `setup-bun` caches only the Bun binary itself — dependency installs run cold, which at this graph size is seconds.
