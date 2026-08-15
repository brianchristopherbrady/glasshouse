# AGENTARIUM

**A glass-box laboratory for watching AI coding agents work.**

AGENTARIUM is a real, working observability tool. It watches an AI agent
(and any subagents it delegates to) as they carry out tasks in this
repository, and renders everything it can *actually observe* as a live
graph, timeline, and inspectable event log.

It is not a mockup. There is no scripted animation standing in for a real
agent run. Every event on screen was either:

- **observed** — captured directly by a VS Code agent hook, the MCP server,
  or a filesystem operation,
- **declared** — self-reported by the agent (e.g. a decision it chose to
  record), not independently verified,
- **inferred** — a best-effort guess from indirect signals, always labeled
  as such, or
- **demo** — replayed from a prerecorded trace, always clearly banner-labeled.

These four provenance levels are never blurred together. See
[docs/architecture.md](docs/architecture.md) for how that's enforced.

---

## Quick start

```bash
npm install
npm start
```

This runs the collector/API server (port 4317) and the Vite dev client
(port 5173) together. Open **http://localhost:5173**.

Other useful commands:

```bash
npm test              # vitest — event schema, redaction, metrics, world validator
npm run build          # tsc -b && vite build
npm run validate:world  # deterministic validator over world/*.json
npm run mcp             # run the MCP server standalone over stdio
```

---

## What you're looking at

The dashboard has five modes, switched from the header:

- **Live** — connects to `/api/stream` (Server-Sent Events) and shows events
  as they happen, across all active sessions.
- **Replay** — pick a previously recorded session (`.agentarium/sessions/*.jsonl`)
  and scrub through its event history.
- **Demo** — play one of the prerecorded traces in `demo/`. Always shown with
  a "Replaying a previously documented incident." banner — demo data is never
  presented as if it were live. No traces ship by default; add your own
  JSONL files (see `scripts/agentarium-hook.mjs`'s event shapes) to use it.
- **Repository** — a live-read catalog of the actual authored agents, Skills,
  and prompts in `.github/`, so you can see what specialization exists
  independent of whether it's been used yet.
- **Compare** — pick two recorded sessions and see their metrics side by
  side (duration, tool calls, files touched, subagents, skills, validation
  failures, repair loops). Every number is derived deterministically from
  the event log — nothing here is invented by an LLM.

Within Live/Replay/Demo you get three panels:

- **Left** — session/trace picker plus a live-computed activity breakdown
  (which agents acted, which Skills were touched, which tools were called,
  which files were read/written).
- **Center** — the live graph (built with `@xyflow/react`, showing actors →
  subagents → tools/Skills as the event log accumulates) above a
  chronological timeline with provenance badges.
- **Right** — the Inspector: click any event and see its full raw JSON, plus
  a plain-language explanation of what its evidence level actually means.

---

## How events get here

1. **Hooks** (`scripts/agentarium-hook.mjs`, wired via `.github/hooks/agentarium.json`)
   fire on 8 VS Code agent lifecycle events (session start, prompt received,
   pre/post tool use, subagent start/stop, pre-compact, stop). The script
   normalizes each into an `AgentariumEvent`, appends it to
   `.agentarium/sessions/<sessionId>.jsonl`, and best-effort notifies the
   live collector over HTTP.
2. **The MCP server** (`mcp/server.ts`) exposes tools (`inspect_world`,
   `validate_world`, `find_dependencies`, `trace_decision`,
   `simulate_change`) and resources (`world://summary`, `world://institutions`,
   `world://relationships`, `world://history`) to the agent. Every tool call and
   resource read is itself an observed event. `trace_decision` is
   the one deliberate, structured place an agent can *declare* a decision —
   always tagged `evidence: "declared"`, never confused with something
   observed.
3. **The collector** (`server/collector.ts`) validates, redacts secrets from,
   persists, and re-broadcasts events over SSE to any connected dashboard.

Every writer that runs outside the main server process (the hook script, the
MCP server) persists to its own JSONL file directly and only uses the
network purely to notify a live dashboard — so a dashboard that isn't open
never causes data loss, and a running collector never causes duplicate
events.

---

## The world-inspection subsystem

`world/*.json` is a generic relational world model -- five domains
(`relationships`, `corrections`, `anomalies`, `characters`, `institutions`)
defined as Zod schemas in `shared/world-types.ts`. The MCP tools
`inspect_world`/`validate_world`/`find_dependencies`/`simulate_change`, the
`trace_decision` declared-decision tool, and `scripts/validate-world.ts`
(`npm run validate:world`) are a working, deterministic, non-LLM validation
subsystem: `ERR_*` issues block validity (orphaned relationships, missing
authorization, uncounted dependents on a correction, open provenance,
temporal duplicates); `WARN_*` issues surface a decision a human should make
without blocking (an anomaly confirmed as systemic, or a candidate pattern
with no documented affinity chain yet). See the `world-validation` Skill for
the full rule table and repair guidance.

Rather than ship this schema empty, `world/` is filled in with a small,
complete example: a City Hall, standing in for a component-library/product
repo. Five agents (`mayor`, `city-planner`, `building-inspector`,
`public-works`, `city-clerk`) act on the world through their own Skills and
record every action in `world/<agent>_actions/actions.md` -- **there is
deliberately no single orchestrator agent**. Each agent runs the `downstream`
and `dispatch` Skills after acting to decide who else needs to know and
write it into `world/dispatch.json` and the affected agents'
`downstream_effects.md`, instead of routing through one coordinator. The
`.github/instructions/municipal-code.instructions.md` file is the bridge
between the fiction and this repo's actual engineering practices -- agents
cite its sections when proposing or authorizing a change. A consuming repo
is meant to swap the City Hall theme for its own domain while keeping the
schema, the agents' division of labor, and the decentralized dispatch
pattern intact.

See the Repository tab, or browse `.github/agents/`, `.github/skills/`,
`.github/instructions/`, and `world/` directly.

---

## Project layout

```text
shared/     event schema (Zod), JSONL event store, redaction, metrics — used by
            both server and MCP server (and read-only by the frontend)
server/     Express collector/API: ingest, SSE stream, replay, repo introspection
mcp/        MCP server: world tools/resources + decision telemetry
scripts/    world validator, the VS Code hook script
src/        React + Vite dashboard
world/      the world-inspection subsystem's data: the City Hall example world,
            plus each agent's action ledger (world/<agent>_actions/) and dispatch.json
demo/       prerecorded demo traces (JSONL); empty by default
tests/      vitest suite
.github/    agents, Skills, prompts, scoped instructions, hook wiring
```

More detail on how the pieces fit together: [docs/architecture.md](docs/architecture.md).
