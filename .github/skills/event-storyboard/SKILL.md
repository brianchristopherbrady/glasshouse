---
name: event-storyboard
description: Enriches a session's Storyboard at .flowbook/storyboards/<sessionId>.json with fuller, agent-written per-beat descriptions. Every session already gets a complete, auto-generated Storyboard with zero agent involvement (see shared/auto-storyboard.ts) -- this Skill is an optional richer layer on top, not the only way a beat gets a description. Generic and repo-agnostic. Run after a session (or a meaningful stretch of one) has produced real story beats worth a fuller account.
---

# Event Storyboard

Every real session's Storyboard is already populated automatically: the
server derives one plain, honest `NarrativeBeat` per real `StoryBeat`
directly from that beat's own fields (`shared/auto-storyboard.ts`,
`source: "auto"`), with no agent, no Skill invocation, and no LLM call
required. A team can open Storyboard mode the moment a session exists and
see a real account of what happened.

This Skill is what an agent runs to *enrich* that account: writing a
fuller, more specific `source: "agent"` description for a beat that
deserves more than the mechanical summary -- more context, better framing,
cross-references the auto pass can't produce. An agent-authored entry
for a beat always replaces its auto entry once written; beats the Skill
doesn't cover keep their auto entry rather than going blank. It is a
Skill, not a character: it writes in third person about what happened,
grounded in evidence, and it does not invent incident.

## When to invoke this Skill

When a session's auto-generated Storyboard entries are too mechanical for
what a team actually needs to understand a flow -- check
`shared/story.ts`'s `buildStoryGraph(events)` over the session's events
(`GET /api/sessions/:id/events` or the live event stream, or just open
Storyboard mode and see which beats would benefit) to see what beats
currently exist. The target is a real session's Storyboard
(`.flowbook/storyboards/`).

Run `interpret-session` first if the session touched files -- it reconciles
the event log against the repo's real current state, so a `file.written`
that was later reverted (or a real change with no matching event) doesn't
get narrated as if the log alone were ground truth.

```
real FlowbookEvents (hooks, MCP, trace_decision, record_story_beat)
  -> shared/story.ts builds the StoryBeat tree (Story mode's flowchart)
  -> shared/auto-storyboard.ts auto-generates a complete Storyboard (no agent needed)
  -> event-storyboard Skill optionally enriches specific beats (this Skill, source: "agent")
  -> server merges auto + agent-authored on every read, agent entries win per-beat
```

## What it does

1. **Build the StoryGraph.** Read the session's events and run
   `buildStoryGraph` (conceptually -- reproduce its logic by reading
   `shared/story.ts` if you can't execute it directly) to get the real list
   of beats: `root`, `agent`, `subagent`, `decision`, `validation`,
   `milestone`, each with its own `id`, `title`, `reason`/`next`/`effects`
   where applicable.
2. **Write one `NarrativeBeat` per real `StoryBeat`** (see
   `shared/narrative-types.ts`), skipping the synthetic `root` beat:
   - `beatId` must match the `StoryBeat.id` exactly (e.g.
     `beat:decision:evt-1234`) so Storyboard mode can cross-reference it
     back to the real event(s).
   - `description`: a real, specific sentence or two about what this beat
     was, grounded in its own `title`/`reason`/`next`/`effects` -- not a
     bureaucratic restatement of the raw label, but not invented plot
     either. If a beat is `unresolved`, say so and why
     (`beat.unresolvedReason`).
   - `involves`: actor ids/names referenced by this beat and its effects.
   - `citedEventIds`: the `FlowbookEvent.id`(s) this description is
     grounded in -- at minimum `beat.sourceEvent.id`, plus any `effects[].id`
     the description actually draws on.
   - `source`: set this to `"agent"` so the UI never presents your entry as
     though it were the mechanical auto pass.
3. **Only write entries that are genuinely richer than the auto pass.** You
   do not need to cover every beat -- beats you skip keep their auto entry.
   If a beat's only evidence is a bare label with no `reason`/`next`/effects,
   the auto entry is already the honest minimum; don't pad it with invented
   plot just to have written something.
4. **Persist.** `PUT /api/narrative/:sessionId/storyboard` with
   `{ "beats": NarrativeBeat[] }` (only the beats you're enriching, not the
   whole session), or write `.flowbook/storyboards/<sessionId>.json`
   directly in the shape of `shared/narrative-types.ts`'s `Storyboard`.

## What this Skill does not do

- It does not skip a beat because its evidence is thin; thin evidence gets a
  thin, honest description instead.
