# Demo workspaces

Small, throwaway repos for manually exercising Flowbook end to
end -- not part of the published package, not real projects. Each one
exists to trigger a different Workspace Map discovery path:

- **`mini-monorepo/`** -- a real `package.json` `workspaces` config (two
  packages, one depending on the other). Exercises `source: "package-manager"`.
- **`mini-book/`** -- no code at all, just an explicit `flowbook.members.json`
  declaring a Part -> Chapter hierarchy. Exercises `source: "config"`.
- **`mini-app/`** -- a plain single-package app with meaningful folders but
  no `workspaces` field. Exercises `source: "folder-heuristic"`.

All three share one real concept -- a **widget** (`{id, name, status}`,
status moving `active` -> `archived`) -- implemented or documented in each
repo's own idiom, so changes across them have a genuine semantic/functional
relationship instead of being arbitrary:

- `mini-monorepo`'s `@mini/core` defines `createWidget()`/`notifyWidgetChange()`
  (same immutable-transition style as its existing `createModal()`);
  `@mini/app` consumes both.
- `mini-app`'s `api/` returns widgets in the same shape; its `workers/`
  now has a real new dependency on `api/` (previously undetected by
  folder-heuristic discovery -- a good case for later running the
  `cartographer` agent / `map-members` Skill on this repo), archiving
  stale widgets in its nightly job.
- `mini-book`'s Chapter 4 ("The Widget Manifest") is the in-universe
  narrative counterpart -- a fictional signal ledger with the same
  active/archived lifecycle, declared as depending on Chapter 3.

A second shared concept builds on the first: **haunted widgets**. A widget
can become `haunted` before retirement, and a real enforced rule --
archiving a haunted widget is blocked until it's `exorcise()`d back to
`active` -- is implemented *independently* (not shared code) in both
JS repos, plus a narrative counterpart:

- `mini-monorepo`'s `@mini/core` widget: `haunt()`/`exorcise()`, and
  `archive()` now throws on a haunted widget.
- `mini-app`'s `api/`: `hauntWidget()`/`exorciseWidget()`, same thrown-error
  rule reimplemented from scratch; `workers/`'s nightly job now skips
  haunted widgets instead of archiving everything unconditionally.
- `mini-book`'s Chapter 5 ("The Haunting"), depending on Chapter 4.
one extra `demo-tester` agent + `demo-smoke-test` Skill (see each repo's
`.github/`) whose only job is generating a believable, real event trail
(touch a couple of members, declare one causal link, declare one decision)
so there's something to look at without needing a live LLM session.

`mini-monorepo/` additionally has a real `planner` -> `implementer` ->
`reviewer` agent chain with genuine VS Code `handoffs:` frontmatter, for
testing the `agent-handoff` Skill and `handoff_agent` MCP tool -- each
agent finishes its part and declares a real `agent.handoff` event before
passing the task on, so Story mode draws a real multi-agent chain instead
of flattening every agent onto one lane.

## Try it

### Option A: from inside this repo (no second VS Code window)

This repo's own `.github/agents/demo-planner.agent.md` /
`demo-implementer.agent.md` / `demo-reviewer.agent.md` are scoped to only
touch `demo-workspaces/mini-monorepo/**`, and already exist here so you
don't have to open a second workspace. With `npm start` running
(collector on :4317, dashboard on :5173, both watching this repo's own
`.flowbook/`), switch to the `demo-planner` agent in chat and ask it to
plan a trivial change to `@mini/core`; follow the handoff buttons (or ask
to continue manually) through `demo-implementer` and `demo-reviewer`.
Watch Live mode and Story mode at http://localhost:5173 update as each
`file.read`/`file.written`/`agent.handoff`/`decision.declared` event lands.

### Option B: watch a demo repo directly, as its own workspace

```powershell
# from the flowbook repo root
node bin/flowbook.mjs start --repo demo-workspaces/mini-monorepo --port 4400 --client-port 5180
```

Open http://localhost:4400, open the `mini-monorepo` folder in a separate
VS Code window, and either work normally with an agent there (hooks are
already wired) or ask the `demo-tester` agent to run its smoke test, or the
`planner`/`implementer`/`reviewer` chain defined inside that repo's own
`.github/agents/`.
