---
name: Observability conventions
description: Conventions for anything that produces or displays flowbook events (server/**, mcp/**, src/**, shared/events.ts).
applyTo: 'server/**,mcp/**,src/**,shared/events.ts,shared/metrics.ts'
---

# Observability conventions

- Every event must set `evidence` honestly: `observed` for hook/tool/MCP/
  filesystem facts, `declared` for agent-emitted decision summaries, and
  `inferred` only when derived from surrounding evidence rather than reported
  directly. Use `checkEvidenceConsistency` (or `createEvent`, which calls it)
  rather than hand-asserting evidence levels.
- Never invent a metric, percentage, or count the event log doesn't actually
  support. Prefer `size unavailable` / an honest blank over a fabricated number.
- Redact before persisting or broadcasting, not after. Route any new payload
  source through `redactEventPayload` / `redact`.
- `parentId` on `FlowbookEvent` is real agent/subagent-hierarchy
  correlation, populated by `scripts/hook-pipeline.mjs`'s `agentStack`
  (pushed on `subagent.started`, popped on `subagent.stopped`): a
  `tool.requested`/`tool.completed`/`tool.failed`/nested `subagent.started`
  event's `parentId` points at the real event id of whichever
  subagent.started spawned it, not a guessed/flattened "main agent" lane.
  Do not assume every agent/subagent/tool event is a root-level event when
  building a new consumer (graph, story, metrics) -- check `parentId` first.
  `metadata.turnId` is a hook-locally-derived turn counter (VS Code has no
  native turn id) and `metadata.toolCallId` mirrors VS Code's own
  `tool_use_id` for correlating a tool's `tool.requested` with its
  `tool.completed`/`tool.failed`.
- VS Code has no dedicated tool-failure hook: `tool.failed` from the hook
  pipeline is a best-effort inference from `tool_response` shape
  (`isError`/`error`), not an authoritative VS Code signal -- still
  `evidence: "observed"` (it's a real inspection of a real response, not a
  guess about unobserved state), but do not present it in the UI as more
  certain than that if you add new copy referencing it.
- Label demo/replayed data as `DEMO` or otherwise distinct from live data in
  the UI. Never let prerecorded events appear indistinguishable from a live run.
- Story mode's flowchart (`shared/story.ts`) can only draw `agent` and
  `milestone` nodes from real sessions if something actually emits
  `agent.started` / `task.completed` events -- no VS Code hook fires either
  one on its own. When you are the acting agent and you genuinely take up a
  case/persona, or you genuinely finish a real unit of work, call the MCP
  tool `record_story_beat` (kind `"agent"` or `"milestone"`) the same way you
  would call `trace_decision` for a decision. Sparingly, at true transitions
  -- do not call it once per turn, and do not use it as a substitute for
  `trace_decision`.
- Likewise, when one custom agent genuinely finishes its part of a task and
  passes the rest to a named successor agent (e.g. via a real VS Code
  `handoffs:` agent-frontmatter button, or just by telling the user to
  switch), call the MCP tool `handoff_agent` -- this is the only source of
  `agent.handoff` events (`evidence: "declared"`; VS Code has no dedicated
  hook for a whole-chat agent handoff). `shared/story.ts` gives handoffs
  their own `"handoff"` beat kind and parents the successor's own
  `agent.started` beat under it, so a chain of handoffs draws as a real
  chain, not flattened agent beats. See `.github/skills/agent-handoff`.
- The narrative layer (`shared/narrative-types.ts`, `shared/narrative-store.ts`,
  `server/narrative.ts`) is keyed to real `StoryBeat` ids from
  `shared/story.ts`, not to any invented locator scheme, so it works for any
  consuming repo. Every session's Storyboard is populated automatically and
  with no agent required: `shared/auto-storyboard.ts` derives one honest
  `NarrativeBeat` per real `StoryBeat` mechanically (`source: "auto"`, same
  no-invention rule as `shared/narrate.ts`), and `server/narrative.ts`'s GET
  route always returns that merged with whatever an agent has additionally
  written. See `.github/skills/event-storyboard` for how an agent
  optionally enriches specific beats (`source: "agent"`, always wins over
  the auto entry for that beat) -- never the only path to a session having
  a Storyboard at all.
- The Workspace Map (`shared/workspace-graph.ts`, `shared/workspace-activity.ts`,
  `src/workspace/WorkspaceMapPanel.tsx`) draws a strict line between three
  kinds of edge, and no code may blur them: the mechanical `package.json`
  dependency graph (always present, never a guess), the co-occurrence
  overlay (two packages both touched in one session -- observed, but never
  implies causation), and the `workspace.linked` declared edge (an agent's
  own account of *why* one package's change required another's). Never
  auto-generate a `workspace.linked` event from co-occurring file edits --
  that would silently upgrade a correlation into a claimed cause. See
  `.github/skills/workspace-map` for how an agent declares one honestly.
- A `sessionId` is one whole VS Code chat conversation, which can span many
  unrelated tasks. When you are the acting agent and a genuinely new,
  distinct unit of work is starting within the current session (not a new
  chat, just a new task in this one), call the MCP tool `start_run` the
  same way you would call `trace_decision`/`record_story_beat` -- this
  emits a `run.started` event (`evidence: "declared"`) and causes every
  subsequent event to carry `metadata.runId`, letting the dashboard's run
  filter (`shared/runs.ts`) isolate just that task's events instead of the
  whole session. Sparingly, at real task boundaries -- not once per turn.
- `.flowbook/current-session.json` is shared, mutable state written by
  both `scripts/hook-pipeline.mjs` (turn/agent correlation) and
  `server/session.ts` (current session/run pointer, updated on every
  ingested event). Any code that writes this file must read-modify-write
  (merge into whatever's already there), never replace it wholesale --
  a prior bare-overwrite bug in `setCurrentSessionId()` silently wiped the
  hook pipeline's turn counter on almost every event. See the comment atop
  `server/session.ts` before touching this file.
