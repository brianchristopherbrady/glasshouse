---
name: dispatch
description: How the dispatch routing protocol works — reviewing canon and relationships after an agent acts, deciding which other agents are actually involved, and writing world/dispatch.json so each agent knows whether and how to read about it. Use immediately after appending to any world/<agent>_actions/actions.md file, and before any agent acts on a handoff.
---

# Dispatch

Dispatch is a Skill, not a character. It has no persona and does not narrate.
It is the mechanism that keeps every agent's awareness honest — an agent only
knows what dispatch has told them they know, and only once it says they may.

This is distinct from the `dispatch` handoff target some agents list for
session-log routing (institutional consequence bookkeeping). That is a
framework-level plumbing concern. This Skill is the in-world awareness router.

## When to invoke this Skill

Immediately after any agent appends a new entry to its own
`world/<agent>_actions/actions.md`. The acting agent (or whichever agent
currently holds the turn) invokes `dispatch` before handing off to anyone.

## What it does

1. **Read the new entry.** Read exactly the chapter.thread.entry that was just
   appended (e.g. `1.1.3`) in the acting agent's `actions.md`.
2. **Review canon and relationships.** Consult the relevant `world/*.json`
   files (`float.json` relationships, `characters.json`, `institutions.json`,
   `corrections.json`, `anomalies.json`) and the acting agent's `.agent.md`
   file, **cross-referenced against the canon in `.github/instructions/`**,
   to determine, for **every** agent in the roster (`mote`, `b`, `noor`,
   `the-choir`, `asterion`, `house-vey`, `simon-kade`, `the-public`), whether that agent has
   a real reason to be aware of what just happened. See "Canon sources for
   involvement decisions" below — do not decide involvement from the JSON
   files alone; the JSON records *what* happened, the canon establishes
   *whether it plausibly reaches someone else*.
3. **Write `world/dispatch.json`**, one entry per agent, per the schema below.
   This is the single file every agent's handoff `prompt:` points to.
4. **Every agent gets invoked.** Nobody is silently skipped at the framework
   level — but the first thing each invoked agent does is read its own entry
   in `world/dispatch.json`. If `involved: false`, that agent's turn ends
   immediately. It does not read the source actions file. It does not guess.

## Canon sources for involvement decisions

The JSON world files record *what happened*. They do not record *who would
plausibly know about it, how, or how fast*. That is a canon question, and
canon lives in `.github/instructions/`. Consult these before deciding
`involved`, `mode`, or `availableAt`:

- **`meta_relationships.md`** — the primary source. Each documented dyad (B↔Noor,
  B↔Mote, Noor↔Mote, etc.) states what connects the two parties, what each
  would notice or be told, and what survives distance or severance. If the
  acting agent's entry touches one leg of a documented relationship, this
  file tells you whether the other party would plausibly know directly
  (`read-actions`), only feel a filtered consequence (`read-downstream`), or
  have no channel to know at all (`involved: false`).
- **`meta_correction.md`** ("03 — Correction") — §Relationships as Braids and
  §Direct Relational Effect vs. Downstream Consequence are the tool for
  deciding whether a correction or investigation touches an agent's *direct*
  relational structure (→ `read-actions`) or only a downstream strand that
  they'd feel without knowing the cause (→ `read-downstream`). §Correction
  Debt explains why a consequence might surface much later — this is the
  canon basis for setting `availableAt`.
- **`meta_bloomrot.md`** — establishes that Bloomrot pressure travels by
  semantic affinity, not by direct notice. An agent connected to a
  bloomrot-linked case is very rarely `read-actions`; they are typically
  `read-downstream` at best, since the network's own mechanic is that
  provenance is indirect.
- **`meta_institutions.md`** — institutional boundaries (the Choir does not see
  Asterion's internal Devs; House Vey answers to no one; Continuity vs.
  Aletheia) determine whether an *institutional* actor would be informed
  through official channel (`read-actions`, likely via a correction or
  authorization record) versus not informed at all (`involved: false`) versus
  informed only through leakage (`read-downstream`, e.g. via Simon Kade).
- **`meta_characters.md`** — individual temperament and disposition (what B
  would investigate versus let go, what Noor can't leave alone, what Mote
  withholds) — use this to judge whether an agent would *seek out* awareness
  even if no one told them, which can justify `read-actions` where the
  institutional path alone would suggest `involved: false`.

If the canon files are silent or ambiguous on a specific pairing, default to
the more restrictive determination (`involved: false`, or `read-downstream`
over `read-actions`) rather than inventing a channel that canon doesn't
support.

## `world/dispatch.json` schema

```json
{
  "generatedAt": "<ISO timestamp>",
  "source": {
    "agent": "<acting agent id>",
    "file": "world/<agent>_actions/actions.md",
    "chapter": "1.1.3"
  },
  "entries": {
    "<agent-id>": {
      "involved": true,
      "mode": "read-actions",
      "reference": "world/<acting-agent>_actions/actions.md#1.1.3",
      "availableAt": null
    },
    "<agent-id>": {
      "involved": true,
      "mode": "read-downstream",
      "reference": "world/<this-agent>_actions/downstream_effects.md#1.1.3",
      "availableAt": null
    },
    "<agent-id>": {
      "involved": false
    }
  }
}
```

Every agent id in the roster must have an entry. There is no default — an
agent not listed is a dispatch bug, not silent non-involvement.

## The two modes of involvement

**`read-actions`** — dispatch has determined this agent would, in canon,
directly witness or be told the acting agent's own account. Point them at the
exact `chapter.thread.entry` in the acting agent's `actions.md`. They read the
full entry, in the acting agent's own voice.

**`read-downstream`** — dispatch has determined this agent should feel the
*consequence* without direct awareness of the acting agent's specific
action — because of scope, because of what the acting agent would or
wouldn't disclose, because the information reaching them has been filtered
or transformed by an intermediary (Mote adjusting a framing, Simon Kade
passing along less than he knows, an institutional channel that reframes
what happened). In this mode, dispatch itself writes the filtered context —
only what that agent would actually receive, in the voice of whoever or
whatever is the actual source of their awareness — into that agent's own
`world/<agent>_actions/downstream_effects.md`, under a new
`chapter.thread.entry` number, and cites that new entry in `reference`. The
target agent never reads the source `actions.md` directly in this mode.

## Delayed availability

If the information would not plausibly reach an agent immediately — travel
time, an institutional delay, a correction not yet noticed, a letter not yet
opened — set `availableAt` to a future point (in-world time, not wall-clock
time, unless the session is tracking wall-clock explicitly). An agent whose
entry has a non-null `availableAt` in the future must not act on that entry
yet. They may still act on other, currently-available business. Re-check
`world/dispatch.json` on a later turn; dispatch (or the agent re-invoking it)
is responsible for clearing `availableAt` to `null` once the in-world moment
arrives.

## Chapter.thread.entry numbering

Format: `<chapter>.<thread>.<entry>`, e.g. `1.1.1`, `1.1.2`, `1.2.1`.

- **chapter** — the current narrative arc. Increments rarely, by editorial
  decision, not automatically per session.
- **thread** — a distinct line of action within the chapter (e.g. one
  investigation, one correction case). A new thread within the same chapter
  increments this: `1.1.x` → `1.2.x`.
- **entry** — sequential within a thread. Each new appended entry in an
  `actions.md` or `downstream_effects.md` increments this: `1.1.1` → `1.1.2`.

Every appended block in every `actions.md` and `downstream_effects.md` file
must be preceded by its own `chapter.thread.entry` heading so dispatch (and
any agent reading a cited reference) can locate it precisely. Do not append
un-numbered prose.

## What dispatch does not do

- It does not decide correction authorization, classification, or execution.
  It only decides awareness and timing.
- It does not fabricate a finding on any agent's behalf. `read-downstream`
  context must be an honest filtration of what actually happened, not an
  invented account.
- It does not skip writing an entry for an agent because the answer is
  "obviously" not involved. Write `involved: false` explicitly so the record
  shows dispatch considered them.
