---
name: agent-handoff
description: Declares a real handoff when one custom agent finishes its part of a task and passes it to a named successor agent (e.g. a "planner" agent handing off to an "implementer" agent via VS Code's handoffs: frontmatter). Generic and repo-agnostic. Run at the moment a handoff genuinely happens, not once per turn.
---

# Agent Handoff

VS Code's real custom-agent `handoffs:` frontmatter feature lets one
`.agent.md` file offer a button that switches the conversation to another
named agent with a pre-filled prompt (see any `.github/agents/*.agent.md`
with a `handoffs:` list). Whether the transition happens through that
button or simply because you, the acting agent, have finished your part
and are telling the user/next agent to take over, this Skill is how that
real event gets recorded so it's honest telemetry, not silently invisible
delegation.

```
Agent A does real work
  -> A's part of the task is genuinely done
  -> A calls handoff_agent({ fromAgent: "A", toAgent: "B", reason })
  -> flowbook records a real agent.handoff event
  -> Story mode draws A -> handoff -> B as a real chain (not two
     disconnected "agent.started" beats on the same flat lane)
```

## When to invoke this Skill

Call the MCP tool `handoff_agent` exactly when you (the acting custom
agent) are done with your part of a task and are passing the remainder to
a specific, named successor agent -- whether via clicking a real
`handoffs:` button or just by telling the user to switch agents. Concrete
examples:

- A `planner` agent finishes writing an implementation plan and hands off
  to an `implementer` agent to write the actual code.
- An `implementer` agent finishes a change and hands off to a `reviewer`
  agent to check it.
- A `demo-tester` agent (see `.github/agents/demo-tester.agent.md` in a
  consuming repo) finishes its smoke-test steps and hands off to whichever
  agent normally owns the repo.

Do **not** call it:

- Once per turn, or as a substitute for `trace_decision` -- a handoff is a
  transition between two distinct agents/personas, not a description of an
  ordinary decision.
- Just because two agents were both active in the same session without one
  actually finishing and handing the rest to the other -- that's two
  independent agent runs, not a handoff. `flowbook` never infers
  a handoff from co-occurrence, same rule as `workspace.linked`.

## What it records

`handoff_agent({ fromAgent, toAgent, reason, summary? })` records one real
`agent.handoff` event (`evidence: "declared"`, since VS Code has no
dedicated hook for a whole-chat agent handoff -- this is self-reported by
the outgoing agent, not independently observed). `reason` must be a real,
specific justification ("the plan is written and reviewed" -- not "handing
off" restated). `summary` is optional free text describing what was
actually accomplished before the handoff, for the successor agent's
context.

## How it shows up

`shared/story.ts`'s `buildStoryGraph` gives the handoff its own `"handoff"`
beat kind, parented under whichever agent/subagent declared it, and the
next `agent.started`/`subagent.started` event parents *under the handoff
beat itself* -- so a real sequence of handoffs draws as a genuine chain
(planner -> handoff -> implementer -> handoff -> reviewer) in Story mode,
not three disconnected beats on one flat lane. A handoff with no observed
follow-up (the successor never shows up as a later beat) is flagged
`unresolved`, the same convention as an unresolved decision or validation
failure.
