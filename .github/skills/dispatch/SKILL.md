---
name: dispatch
description: How the dispatch routing protocol works in the City Hall example world -- reviewing what an agent did and deciding which other agents are actually involved, then writing world/dispatch.json so each agent knows whether and how to read about it. Use immediately after appending to any world/<agent>_actions/actions.md file, and before any agent acts on a handoff.
---

# Dispatch

After any agent (Mayor, City Planner, Building Inspector, Public Works,
City Clerk) appends a new entry to its own `world/<agent>_actions/actions.md`,
run this Skill before moving on. This is deliberately **not** run by a
single orchestrator agent -- any agent can and should run it after its own
actions, and the City Clerk runs it as part of its own role, but no agent
waits for the Clerk's permission to act first.

## What to do

1. Read the new `actions.md` entry (it has a `## chapter.thread.entry`
   locator, e.g. `## 1.1.1`) and whichever `world/*.json` files it touched.
2. For each of the other four agents, decide: is this agent genuinely
   involved (something they authorized, something in their domain, or
   something that changes what they'd decide next), or just adjacent?
   Don't mark an agent "involved" reflexively -- an uninvolved agent's
   `downstream_effects.md` should stay quiet, not accumulate noise.
3. Run the `downstream` Skill **first** for every agent marked involved --
   it writes the actual filtered content each of them would plausibly know.
   Dispatch only records *whether* and *how* they're involved, not the
   content itself.
4. Write (or update) an entry in `world/dispatch.json` keyed by the same
   locator, recording each agent's involvement as `true`/`false` and, if
   `true`, how they became aware (e.g. `"authorized"`, `"executed"`,
   `"informed"`).

## Example entry shape

```json
{
  "1.1.1": {
    "mayor": { "involved": true, "mode": "authorized" },
    "city-planner": { "involved": false },
    "building-inspector": { "involved": true, "mode": "executed" },
    "public-works": { "involved": false },
    "city-clerk": { "involved": true, "mode": "recorded" }
  }
}
```

## Why this stays decentralized

A single dispatcher agent that decided everyone's involvement centrally
would become the de facto orchestrator this roster deliberately doesn't
have. Keeping dispatch as a Skill any agent runs after its own actions
means each agent's judgment about its own domain stays load-bearing --
the City Clerk's copy of `dispatch.json` is the shared record, not a
command.
