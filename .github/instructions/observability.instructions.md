---
name: Observability conventions
description: Conventions for anything that produces or displays AGENTARIUM events (server/**, mcp/**, src/**, shared/events.ts).
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
- The generic narrative layer (`shared/narrative-types.ts`,
  `shared/narrative-store.ts`, `server/narrative.ts`) is separate from this
  repo's `world/*` fiction ledger (`server/book.ts`). It is keyed to real
  `StoryBeat` ids from `shared/story.ts`, not to invented
  `chapter.thread.entry` locators, so it works for any consuming repo. See
  `.github/skills/event-storyboard` and `.github/skills/event-book` for how
  an agent populates a session's Storyboard and Book.
