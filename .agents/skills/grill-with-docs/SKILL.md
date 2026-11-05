---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

Call the Skill tool twice, for "grilling" and "domain-modeling".

Before the first round, run the routing sweep (`AGENTS.md` § Skill routing) over the design being grilled, and sweep again whenever an answer opens a branch in a new area: a database, a UI direction, an endpoint, Tauri capabilities, motion, security, the domain model itself.

The swept skills are what the round is grilled _with_. Their rules become the questions you ask and the recommended answer you give beside each one: a decision about aggregates or boundaries is settled against `domain-modeling` and `codebase-design`, a schema decision against the Databases row, not against your memory of them. Say which skills a round was swept with.

The ADRs and glossary entries the design resolves are written by `domain-modeling` as they settle, and every name they fix becomes the vocabulary the rest of the interview uses.
