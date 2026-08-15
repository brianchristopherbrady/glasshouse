---
name: downstream
description: Writes the filtered, indirect-awareness content another agent would actually pick up from an action -- reviewing the acting agent's own actions.md entry and any world/*.json files it touched -- into that other agent's own world/<agent>_actions/downstream_effects.md. Invoke immediately after an agent appends a new entry to its own actions.md, and always before the dispatch Skill.
---

# Downstream

An agent's `actions.md` is written in its own voice, for its own record. Not
every other agent needs the full entry -- most only need the part that
actually changes what they'd decide next. This Skill writes that filtered
slice into the *other* agent's `world/<agent>_actions/downstream_effects.md`.

## How to write a downstream_effects.md entry

1. Read the acting agent's new `actions.md` entry (identified by its
   `## chapter.thread.entry` locator) and whichever `world/*.json` files it
   changed.
2. For each other agent, ask: what would this agent plausibly need to know,
   phrased from *their* vantage point, not the acting agent's? This is not
   a copy of the entry -- it's what filters through.
   - Skip agents for whom nothing changed that touches their domain,
     authority, or an open item of theirs. A quiet `downstream_effects.md`
     is correct, not incomplete.
   - Keep it to what's actually knowable secondhand: a completed
     correction, a new authorization, a reclassified issue, a pending
     escalation -- not internal reasoning the acting agent didn't record.
3. Append the filtered entry under the same locator, in the receiving
   agent's own `downstream_effects.md`, written plainly ("Building Inspector
   classified issue-water-pressure as systemic_candidate and confirmed it
   traces to shared infrastructure"), not copied verbatim from the source.
4. Do this for every agent who is plausibly involved *before* running the
   `dispatch` Skill -- `dispatch` records the routing decision;
   `downstream` is what makes that decision correspond to real written
   content instead of an empty flag.

## What this Skill does not do

- It does not decide what another agent must do next -- that's still each
  agent's own judgment, exercised via its own `handoffs`. `downstream` only
  makes sure the information they'd need to make that judgment is actually
  on record.
- It does not edit `relationships.json`, `issues.json`, `corrections.json`,
  or `institutions.json` -- only `downstream_effects.md` files.
