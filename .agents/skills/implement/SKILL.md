---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Run the routing sweep (`AGENTS.md` § Skill routing) before writing anything, and sweep again the moment the work moves into an area the first sweep missed — a second language, the database, a UI surface, an endpoint, motion, anything security-shaped. Each matched skill is invoked and its rules are the ones you apply while writing in its area: the Rust row while writing `src-tauri/`, the Tauri row while touching capabilities or IPC, the Databases row while changing schema, the Architecture row while moving a boundary or an aggregate's ownership, the Security row while any user input crosses a boundary. Sweeping once at the top and coding from memory is the failure.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, sweep again over the finished diff and call the Skill tool with "code-review" to review the work.

When work goes to a sub-agent, the sweep's matched names go in its brief: a sub-agent does not arrive with them.

Commit your work to the current branch.
