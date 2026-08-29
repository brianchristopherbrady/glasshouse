---
name: demo-smoke-test
description: Generates a small, real event trail in this demo repo (mini-monorepo) for testing Flowbook -- touches both packages, declares one causal link, declares one decision. Testing-only.
---

# Demo Smoke Test (mini-monorepo)

Run these steps in order, in this repo, with Flowbook's hooks
active (already wired to `.github/hooks/flowbook.json`):

1. Read [packages/core/src/widget.js](packages/core/src/widget.js) -- the
   widget concept (`{id, name, status}`, active -> archived) shared across
   all three `demo-workspaces` repos.
2. Make a trivial real edit to it (e.g. add a third status to
   `WIDGET_STATUSES`).
3. Read [packages/app/src/index.js](packages/app/src/index.js), which
   imports `createWidget`/`notifyWidgetChange` from `@mini/core` --
   confirm the edit is compatible.
4. Call the MCP tool `link_workspaces` with
   `{ from: "@mini/core", to: "@mini/app", reason: "changed @mini/core's widget status lifecycle, @mini/app consumes it directly" }`.
5. Call the MCP tool `trace_decision` summarizing what you just did and why.

This produces real `file.read`/`file.written`/`workspace.linked`/
`decision.declared` events for the Live/Workspace/Story views to show.

## Testing the haunted-widget rule

`widget.js`'s `haunt()`/`exorcise()` add a real enforced rule: `archive()`
throws if the widget is `haunted`, reimplemented independently in
`mini-app`'s `api`/`workers`. Read [packages/app/src/index.js](packages/app/src/index.js)
and run it (or trace through it) to see the full haunt -> blocked archive
-> exorcise -> archive sequence, then call `trace_decision` noting which
rule you verified and why the thrown error is the correct behavior, not a
bug.

## Testing agent handoffs

This repo also has a real `planner` -> `implementer` -> `reviewer` agent
chain (`.github/agents/*.agent.md`, with real VS Code `handoffs:`
frontmatter) for testing `.github/skills/agent-handoff`. Switch to the
`planner` agent and ask it to plan a trivial change to `@mini/core`; follow
the handoff buttons (or continue manually) through `implementer` and
`reviewer`. This produces two real `agent.handoff` events, showing up in
Story mode as a real planner -> handoff -> implementer -> handoff ->
reviewer chain, not three disconnected agent beats.
