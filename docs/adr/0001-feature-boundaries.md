# 1. Feature boundaries and the composition-only shell

Date: 2026-10-27

Status: accepted

## Context

The frontend was reorganized from a type-based layout (`src/components`, `src/store`, …) into feature slices under `src/features/<feature>` (catalog, release, continue-watching, player, downloads, bookmarks, settings). Without an enforced rule, features can silently re-couple to each other's internals and the old structure comes back.

## Decision

- Each feature owns its UI, hooks, and state under `src/features/<feature>/` and exposes a public surface only through its `index.ts` barrel.
- A feature may import the shared layer (`@/shared/**`), its own internals, and other features **only through their barrel** (`@/features/<other>`). Importing another feature's internals (`@/features/<other>/ui/…`, `../<other>/…`) is forbidden.
- Code outside `src/features` (the application shell `src/app`, entry points) reaches features only through their barrels.
- The application shell (`src/app/App.tsx`, `src/app/Header.tsx`) only composes features: screen routing, wiring of stores' lifecycle effects, and shell chrome. Feature-specific markup lives inside the owning feature (e.g. the home releases grid is `catalog/ui/ReleasesGrid`).
- Old type-based module paths (`src/components`, `src/store`, root `src/App.tsx`) are removed, not kept as re-export shims.

## Consequences

- Cross-feature coupling is visible at the barrel boundary; renaming internals stays a local change.
- The rule is checked automatically by `tests/test_feature_boundaries.test.ts` (static specifier scan + stray-path assertions), run in CI with the rest of the Vitest suite.
- The scan covers `src/` only, so tests may still import feature internals to unit-test them.
