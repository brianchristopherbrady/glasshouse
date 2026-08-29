---
name: workspace-map
description: Declares causal links between real repo members (packages, folders, book chapters, or whatever this repo's own map represents) after an agentic flow that touched more than one -- e.g. a web-component package changed and its React/Angular wrapper had to change too. Generic and repo-agnostic. Run at the end of a session (or a meaningful stretch of one) that touched more than one member, so the Workspace Map shows why, not just that both changed.
---

# Workspace Map

The Workspace Map (the "workspace" view in the dashboard) is built from two
kinds of real data, and this Skill is only responsible for the second one:

1. **The mechanical/declared member graph** -- every repo member (a
   package, a folder, a book chapter, or any other real unit the repo's
   own `flowbook.members.json`/package-manager config/folder layout
   defines -- see `.github/skills/map-members`) and its real dependency
   edges, produced by `shared/workspace-graph.ts`. You never author this
   directly through this Skill; it's read straight off disk every time the
   graph is requested. If the graph looks wrong for this repo (e.g. it's
   just a flat folder-heuristic list when the repo actually has real
   hierarchy), that's a job for the `cartographer` agent /
   `map-members` Skill, not this one.
2. **The declared causal links** -- when a change in one member required a
   change in another *for a real reason specific to this session*, not
   just because both happened to be edited. This Skill's whole job is
   writing that second kind, honestly, via the `link_workspaces` MCP tool.

```
you edit members A and B during a session
  -> flowbook already knows both were touched (real file.written events)
  -> workspace-map Skill (you) decides: was B's change actually REQUIRED by
     A's change, or did they just both need touching independently?
  -> if required: call link_workspaces({ from: A, to: B, reason })
  -> if not: call nothing -- the Workspace Map already shows both as
     "touched this session" without implying either caused the other
```

## When to invoke this Skill

At the end of a session (or a meaningful stretch of one) where you touched
more than one workspace member. Check what you actually touched by calling
`discover_workspaces` (to get real member ids/paths) and cross-referencing
against the files you edited this session -- or just recall it directly,
since you were the one editing.

Run `interpret-session` first -- only declare a `workspace.linked` edge for
a change that's actually still real on disk, not one the log recorded but
which was later reverted.

## What counts as a real causal link

Call `link_workspaces({ from, to, reason })` only when you can state a
concrete, specific reason `to` had to change *because of* the change in
`from` -- not a vague sense that they're related. Genuine examples:

- You changed a web-component's public API (`from`: the web-component
  package) and had to update its React wrapper to match the new prop
  signature (`to`: the React wrapper package). Reason: "renamed `variant`
  prop to `tone`, updated the wrapper's type definitions and passthrough."
- You fixed a bug in a shared design-token package (`from`) that required
  regenerating a consuming theme package's compiled output (`to`).

Do **not** call it when:

- Two members were both touched but for unrelated reasons (e.g. you fixed
  a typo in one and added a feature to another in the same session). Leave
  them as two independently-touched nodes -- the Workspace Map's
  co-occurrence overlay (blue dashed edge) already shows they were both
  touched without you having to assert a cause.
- You're not sure whether the second change was actually required or just
  convenient to do at the same time. An honest "I don't know if this was
  required" is better than a confident-sounding link that overstates the
  relationship (same principle as `trace_decision`'s evidence discipline).
- The dependency is already fully explained by a mechanical/declared edge
  already in the graph (e.g. `to` imports `from` and you only changed
  `from`'s internals in a way that didn't change its public contract) --
  the gray dependency edge already tells that story; a duplicate amber
  link adds noise, not signal.

## How to call it

```
link_workspaces({
  from: "<real member id, e.g. @acme/button-web-components or a config member id like \"ch-3\">",
  to: "<real member id, e.g. @acme/button-react>",
  reason: "<specific, concrete reason -- what changed and why it forced the other change>",
  actorName: "<your agent/persona name, if you have one>"
})
```

Call it once per genuine causal edge. If your session touched three
members in a genuine chain (A forced B, B forced C), call it twice --
once for A→B, once for B→C -- rather than a single link skipping the
middle member.

## What this Skill does not do

- It does not decide *whether* to touch a second member -- that's an
  ordinary engineering decision you make (and can record with
  `trace_decision` if it was non-obvious), separate from *declaring* the
  link afterward.
- It does not edit the member graph itself -- `shared/workspace-graph.ts`
  produces the mechanical/config-driven graph, and `.github/skills/map-members`
  is how a repo's own explicit map gets authored. This Skill only ever
  emits `workspace.linked` events.
- It does not retroactively link members from a past session you didn't
  work in -- only declare links for changes you made and can actually
  explain.
