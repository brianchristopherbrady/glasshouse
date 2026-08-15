---
name: event-storyboard
description: Turns a session's real StoryBeats (shared/story.ts, built from real AgentariumEvents) into an agent-authored Storyboard at .agentarium/storyboards/<sessionId>.json. Generic and repo-agnostic. Run after a session (or a meaningful stretch of one) has produced real story beats, before event-book.
---

# Event Storyboard

Event Storyboard turns a consuming repo's real telemetry into one real,
specific, per-beat description an operator (or `event-book`) can actually
use. It is a Skill, not a character: it writes in third person about what
happened, grounded in evidence, and it does not invent incident.

## When to invoke this Skill

After a session has accumulated real `StoryBeat`s worth narrating -- check
`shared/story.ts`'s `buildStoryGraph(events)` over the session's events
(`GET /api/sessions/:id/events` or the live event stream) to see what beats
currently exist. The target is a real session's Storyboard/Book
(`.agentarium/storyboards/`, `.agentarium/books/`).

```
real AgentariumEvents (hooks, MCP, trace_decision, record_story_beat)
  -> shared/story.ts builds the StoryBeat tree (Story mode's flowchart)
  -> event-storyboard Skill writes .agentarium/storyboards/<sessionId>.json (this Skill)
  -> event-book Skill writes .agentarium/books/<sessionId>.json
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
     `beat:decision:evt-1234`) so `event-book` and the UI can cross-reference
     it back to the real event(s).
   - `description`: a real, specific sentence or two about what this beat
     was, grounded in its own `title`/`reason`/`next`/`effects` -- not a
     bureaucratic restatement of the raw label, but not invented plot
     either. If a beat is `unresolved`, say so and why
     (`beat.unresolvedReason`).
   - `involves`: actor ids/names referenced by this beat and its effects.
   - `citedEventIds`: the `AgentariumEvent.id`(s) this description is
     grounded in -- at minimum `beat.sourceEvent.id`, plus any `effects[].id`
     the description actually draws on.
3. **Do not invent plot.** If a beat's only evidence is a bare label with no
   `reason`/`next`/effects, the description should be equally minimal and
   say so -- same rule as the `storyboard` Skill's "thin source, thin
   description" principle.
4. **Persist.** `PUT /api/narrative/:sessionId/storyboard` with
   `{ "beats": NarrativeBeat[] }`, or write
   `.agentarium/storyboards/<sessionId>.json` directly in the shape of
   `shared/narrative-types.ts`'s `Storyboard`.

## What this Skill does not do

- It does not decide narration style or write prose -- that is `event-book`.
- It does not touch `world/storyboard.json` or any `world/*_actions` file --
  those belong to this repo's own fiction-ledger `storyboard` Skill.
- It does not skip a beat because its evidence is thin; thin evidence gets a
  thin, honest description instead.
