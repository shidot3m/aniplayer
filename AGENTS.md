## Engineering rules

- **Do not accumulate technical debt.** Fix the root cause instead of layering workarounds. Do not leave stubs, disabled checks, or known shortcuts behind. If a temporary compromise is unavoidable, create a tracked issue, reference it from the code, and remove it before the task is done.
- **Search the tracker before filing.** Before creating an issue, list open issues and check whether the work is already tracked (`gh issue list --state open --json number,title`); if a ticket covers it, reference that one instead of opening a duplicate.
- **Prefer the latest stable versions.** Use current releases of dependencies, runtimes, and CI actions instead of stale pinned majors. Outdated versions are technical debt: upgrade them as part of the work that touches them, not in a later cleanup. Confirm the current release against official sources before bumping.
- **Verify current documentation first.** Before implementing or changing a dependency, check the current version, API, and deprecations against official docs or primary sources. Do not rely on memory for framework or library specifics.
- **Keep documentation current.** Documentation must always describe the current code. Every behavioral, structural, or dependency change updates the documents it invalidates — `README.md`, `GLOSSARY.md`, `docs/architecture.md`, and the affected ADRs — in the same commit. Stale or contradictory documentation is a defect to fix, not a follow-up.
- **Respect feature boundaries.** Features may import their own internals, the shared layer, and other features only through their barrels; the application shell only composes features. The rule and its automated check are documented in `docs/architecture.md`.
- **Use skills for all work.** The skill set is vendored under `.agents/skills/` and version-controlled, so every clone carries it; draw from that directory. Select the relevant installed skill before acting. If none fits, state that explicitly and proceed with the closest applicable practice.
- **Run the app yourself.** Do not hand runtime passes back to the user. Launch the actual app (or the closest runnable build), drive the affected flow, and record the evidence — commands, screenshots, observed values — in the ticket. Defer only checks that need hardware, credentials, or physical input an agent cannot supply.
- **Land finished work yourself.** Once a change is complete and verified, commit and push it in the same turn, without waiting for a go-ahead. When every acceptance criterion of the ticket is met with evidence — automated gates green and behavior confirmed, including any manual runtime pass the ticket asks for — land the branch on `master` (`git push origin HEAD:master`) and delete it on the spot. A rejected push means `master` moved: rebase onto it and retry; never force. While a criterion is still open, keep the branch pushed and name the open criterion.
- **Keep aislop at 100/100.** Run `bunx aislop scan` before committing; the score must be 100 out of 100. Fix every finding instead of ignoring it.
- **Ответы в чате — кратко и на русском.** Все ответы пользователю в чате должны быть короткими и на русском языке.

## Skill routing

| Task              | Start with                                    | Also use                                                                   |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Spec, tickets     | `to-spec`, `to-tickets`                       | `grilling`, `domain-modeling`, `wayfinder`                                 |
| Architecture      | `codebase-design`                             | `improve-codebase-architecture`, `domain-modeling`                         |
| Rust              | `rust-best-practices`                         | `rust-async-patterns`, `domain-cloud-native`                               |
| React performance | `vercel-react-best-practices`                 | `vercel-composition-patterns`                                              |
| UI direction      | `frontend-design`, `design-taste-frontend`    | `web-design-guidelines`                                                    |
| UI clean-up       | `unslop`                                      | `frontend-design`, `design-taste-frontend`, `web-design-guidelines`        |
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

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root, with the current module map and data flows in `docs/architecture.md`. See `docs/agents/domain.md`.
