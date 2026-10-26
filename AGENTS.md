## Engineering rules

- **Do not accumulate technical debt.** Fix the root cause instead of layering workarounds. Do not leave stubs, disabled checks, or known shortcuts behind. If a temporary compromise is unavoidable, create a tracked issue, reference it from the code, and remove it before the task is done.
- **Prefer the latest stable versions.** Use current releases of dependencies, runtimes, and CI actions instead of stale pinned majors. Outdated versions are technical debt: upgrade them as part of the work that touches them, not in a later cleanup. Confirm the current release against official sources before bumping.
- **Verify current documentation first.** Before implementing or changing a dependency, check the current version, API, and deprecations against official docs or primary sources. Do not rely on memory for framework or library specifics.
- **Use skills for all work.** Select the relevant installed skill before acting. If none fits, state that explicitly and proceed with the closest applicable practice.
- **Commit and push immediately.** Once a change is complete and verified, commit it and push to the remote in the same turn. Do not leave finished work uncommitted and do not ask for permission to commit or push.
- **Keep aislop at 100/100.** Run `npx aislop scan` before committing; the score must be 100 out of 100. Fix every finding instead of ignoring it.

## Skill routing

| Task              | Start with                                    | Also use                                                                   |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Spec, tickets     | `to-spec`, `to-tickets`                       | `grilling`, `domain-modeling`, `wayfinder`                                 |
| Architecture      | `codebase-design`                             | `improve-codebase-architecture`, `domain-modeling`                         |
| Rust              | `rust-best-practices`                         | `rust-async-patterns`, `domain-cloud-native`                               |
| React performance | `vercel-react-best-practices`                 | `vercel-composition-patterns`                                              |
| UI direction      | `frontend-design`, `design-taste-frontend`    | `web-design-guidelines`                                                    |
| Tauri             | `tauri-v2`                                    | `tauri-security`                                                           |
| API / gRPC        | `api-and-interface-design`                    | `contract-first`, `protobuf`, `grpc-development`                           |
| Databases         | `sqlite-database-expert`, `postgres-patterns` | `database-migration`                                                       |
| Tests             | `tdd`                                         | `rust-testing`, `vitest`, `react-testing-library`, `playwright`            |
| Motion            | `animate`                                     | `review-animations`, `improve-animations`, `vercel-react-view-transitions` |
| Security          | `security-and-hardening`                      | `owasp-security`, `tauri-security`                                         |
| Review, debugging | `code-review`, `diagnosing-bugs`              | `review-animations`, `owasp-security`                                      |

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `shidot3m/aniplayer`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
