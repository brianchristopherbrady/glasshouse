---
name: demo-smoke-test
description: Generates a small, real event trail in this demo repo (mini-app) for testing Flowbook -- touches two folders, declares one causal link, declares one decision. Testing-only.
---

# Demo Smoke Test (mini-app)

Run these steps in order, in this repo, with Flowbook's hooks
active (already wired to `.github/hooks/flowbook.json`):

1. Read [api/index.js](api/index.js) -- widgets here use the same
   `{id, name, status}` shape and active/archived lifecycle as
   `mini-monorepo`'s `@mini/core` widget concept.
2. Make a trivial real edit to it (e.g. add a third widget to the list).
3. Read [workers/index.js](workers/index.js), which imports `getWidgets`/
   `updateWidgetStatus` from `../api` to archive stale widgets in the
   nightly job -- confirm the edit is compatible.
4. Call the MCP tool `link_workspaces` with
   `{ from: "api", to: "workers", reason: "changed the widget list api/index.js exposes, workers/index.js's nightly job archives every widget it returns" }`.
5. Call the MCP tool `trace_decision` summarizing what you just did and why.

This produces real `file.read`/`file.written`/`workspace.linked`/
`decision.declared` events for the Live/Workspace/Story views to show.

## Testing the haunted-widget rule

`api/index.js`'s `hauntWidget()`/`exorciseWidget()` and `updateWidgetStatus()`
enforce the same rule as `mini-monorepo`'s `@mini/core`, reimplemented
independently: a haunted widget can't move straight to `archived`.
`workers/index.js`'s `runNightlyJob()` now skips haunted widgets instead of
archiving everything. Run it (or trace through it) and confirm `widget-b`
(seeded `haunted`) is reported skipped, then call `trace_decision` noting
what you verified.
