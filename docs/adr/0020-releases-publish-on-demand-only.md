# 20. Releases publish on demand only; the nightly schedule is dropped

Date: 2026-11-13

Status: accepted

## Context

`release.yml` carried three triggers: a `schedule: cron "0 3 * * *"` nightly, `workflow_dispatch`, and `push: tags ["v*"]`. The nightly rebuilt `master` every day and, through the rolling-release branch of the publish step ([ADR 0016](0016-portable-archive-and-per-user-nsis-installer.md)), overwrote the `latest` release: `gh release upload … --clobber` replaced all three assets, the release notes were regenerated with a fresh `Built: $(date -u)` stamp and the run URL, and the mutable `latest` git ref was force-moved to `$GITHUB_SHA`.

None of that was gated on a change. Every night — even when `master` had not moved since the day before — the app was recompiled, the `latest` binaries were replaced, and its notes changed. A rolling build of unchanged code is churn, not a release: it costs a Windows runner and a full `cargo build` for a download that is byte-equivalent in intent to the one already published, and it kept `latest` moving under anyone who had linked it. The maintainer asked for new releases only when they decide to make one.

## Decision

- **The `schedule` trigger is removed.** `release.yml` now publishes only on `workflow_dispatch` and on `push: tags ["v*"]` — both deliberate acts: pressing Run workflow, or pushing a version tag. Nothing is built or published on the clock.
- **Manual and tagged releases keep the exact publish behavior of [ADR 0016](0016-portable-archive-and-per-user-nsis-installer.md).** A `workflow_dispatch` on the default branch refreshes the rolling `latest` release and moves its ref; a `v*` tag publishes its own not-latest release and leaves the tag where it was cut. Only the automatic trigger is gone; the two release shapes and their guards are unchanged.
- **The job's branch guard is left as it was.** Its `if:` already requires a non-push run to be on the default branch, so a manual dispatch from a feature branch still cannot publish.

## Considered options

- **Keep the nightly but skip publishing when `latest` already points at `$GITHUB_SHA`** — rejected: it still burns a full Windows build to discover nothing changed, and a build is not reproducible here (the notes embed the build time and run ID), so "skip the publish" still leaves a pointless daily compile.
- **Remove tags too, leaving only `workflow_dispatch`** — rejected: pushing a `v*` tag is the deliberate, versioned cut the channel is built around; it is already "when I need it," so removing it would only take away the cleaner way to make one.
- **Keep the nightly, accept the churn** — rejected: this is the behavior the request is against.

## Consequences

- `latest` moves only when a human runs the workflow on the default branch; a day with no changes is a day with no build and no download-page edit.
- [ADR 0006](0006-portable-only-distribution.md) and [ADR 0016](0016-portable-archive-and-per-user-nsis-installer.md) described the nightly as a live trigger; their trigger lists are now historical, and this ADR governs how releases are triggered.
- The rolling `latest` channel needs someone to press Run workflow after landing work; nothing refreshes it on its own.
