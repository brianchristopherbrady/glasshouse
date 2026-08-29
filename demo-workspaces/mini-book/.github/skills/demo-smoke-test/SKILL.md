---
name: demo-smoke-test
description: Generates a small, real event trail in this demo repo (mini-book) for testing Flowbook -- touches two chapters, declares one causal link, declares one decision. Testing-only.
---

# Demo Smoke Test (mini-book)

Run these steps in order, in this repo, with Flowbook's hooks
active (already wired to `.github/hooks/flowbook.json`):

1. Read [manuscript/part-2/chapter-3.md](manuscript/part-2/chapter-3.md).
2. Make a trivial real edit to it (e.g. add one sentence).
3. Read [manuscript/part-2/chapter-4.md](manuscript/part-2/chapter-4.md) --
   the in-universe counterpart to the widget status lifecycle (active ->
   archived) implemented in `mini-monorepo`/`mini-app` -- which
   `flowbook.members.json` declares as depending on Chapter 3, confirm
   it's still consistent with the edit.
4. Call the MCP tool `link_workspaces` with
   `{ from: "ch-3", to: "ch-4", reason: "changed a plot detail in Chapter 3 that Chapter 4 references directly" }`.
5. Call the MCP tool `trace_decision` summarizing what you just did and why.

This produces real `file.read`/`file.written`/`workspace.linked`/
`decision.declared` events for the Live/Workspace/Story views to show.

## Testing the haunted-widget rule

Read [manuscript/part-2/chapter-5.md](manuscript/part-2/chapter-5.md) --
the narrative counterpart to the haunted-widget rule implemented
independently in `mini-monorepo`/`mini-app` (a haunted entry can't be
archived until exorcised). Make a trivial real edit, then call
`link_workspaces` with `{ from: "ch-4", to: "ch-5", reason: "changed a
plot detail in Chapter 4 that Chapter 5 references directly" }` and
`trace_decision` summarizing what you did.
