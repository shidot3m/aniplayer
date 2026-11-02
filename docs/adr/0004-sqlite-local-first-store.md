# 4. SQLite as the local-first store

Date: 2026-11-02

Status: accepted

## Context

User state — bookmarks, watch progress, settings, and the index of downloaded episodes — must survive restarts and remain available without a network. The app is portable and Windows-only, so there is no server to hold this state and no database service to install. The catalog itself is authoritative in the AniLiberty API; the local store only has to remember what the user did.

## Decision

- Use SQLite through `rusqlite` with the `bundled` feature, so the database engine is compiled into the executable and the portable bundle needs no external runtime.
- Keep the file at `data/aniplayer.db` next to the executable. Startup computes that directory from `current_exe()` and fails visibly if the file cannot be opened; there is no silent in-memory fallback.
- Open one `Connection` behind a `Mutex` in `Database`. This serializes writes and keeps the ownership model simple; the expected workload is small and local.
- Create the schema idempotently at startup with `CREATE TABLE IF NOT EXISTS`:
  - `bookmarks` — one row per Release, with a Bookmark category and a JSON snapshot of the Release metadata;
  - `history` — one row per (Release, Episode), with last position, duration, and completion flag;
  - `downloaded_episodes` — one row per Downloaded episode, with file path, size, Quality, Skip timecodes, and Download status;
  - `app_settings` — key/value rows for Settings.
- Treat the API as the source of truth for catalog data. A Bookmark stores a snapshot so an offline library can render without the API, but the Release id remains the identity and can be re-resolved online.

## Considered options

- **JSON files per concern** — rejected: no atomic updates across related records, no query for Continue Watching, and hand-written merging.
- **WebView `localStorage` or IndexedDB** — rejected: not shared with the Rust download indexer, tied to the WebView data directory, and easily lost when the portable folder is moved.
- **A separate database service** — rejected: contradicts the portable, zero-install constraint.

## Consequences

- The portable folder is self-contained: `aniplayer.db` travels with it.
- One writer at a time simplifies reasoning but means long database operations stall other commands; queries are kept small and local.
- Schema evolution needs an explicit migration. The initializer only creates missing tables, so changing an existing column requires a migration step and a test before it can ship.
- A bookmark can outlive a renamed or removed Release; the UI resolves the saved JSON first and refreshes from the API when it is available.
