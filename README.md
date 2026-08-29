# FLOWBOOK

**A glass-box laboratory for watching AI coding agents work -- in any repo.**

Flowbook is a real, working observability tool. Point it at any
repo and it watches an AI agent (and any subagents it delegates to) as they
carry out tasks there, rendering everything it can *actually observe* as a
live graph, timeline, and inspectable event log.

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

## Quick start (watch any repo)

```bash
cd /path/to/the/repo/you/want/to/watch
npx flowbook init     # wires .github/hooks/flowbook.json + .vscode/mcp.json
npx flowbook start    # starts the collector + dashboard, watching this repo
```

Open **http://localhost:4317**. Work normally in that repo with a VS Code
agent -- every hook-observed event and every MCP tool call shows up live.

`flowbook start` accepts:

```bash
npx flowbook start --repo /path/to/other/repo   # watch a repo other than cwd
npx flowbook start --port 4400 --client-port 5180
```

## Developing Flowbook itself

```bash
npm install
npm start
```

This runs the collector/API server (port 4317) and the Vite dev client
(port 5173) together against this repo's own `.flowbook/` data. Open
**http://localhost:5173**.

Other useful commands:

```bash
npm test          # vitest — event schema, redaction, metrics
npm run build      # tsc -b && vite build (also what `npx flowbook start` serves)
npm run mcp         # run the MCP server standalone over stdio
```

### Watching a real multi-agent handoff, locally

With `npm start` running, switch to the `demo-planner` custom agent in
chat (`.github/agents/demo-planner.agent.md`) and ask it to plan a trivial
change under [demo-workspaces/mini-monorepo](demo-workspaces/mini-monorepo)
(scoped so it never touches anything else in this repo). Follow its
handoff button through `demo-implementer` then `demo-reviewer` — each hands
off with a real `agent.handoff` MCP call, so http://localhost:5173's Live
and Story views update with an actual multi-agent chain instead of a
scripted demo trace. See [demo-workspaces/README.md](demo-workspaces/README.md).

---

## What you're looking at

The dashboard has several modes, switched from the header:

- **Live** — connects to `/api/stream` (Server-Sent Events) and shows events
  as they happen, across all active sessions.
- **Replay** — pick a previously recorded session (`.flowbook/sessions/*.jsonl`)
  and scrub through its event history.
- **Demo** — play one of the prerecorded traces in `demo/`. Always shown with
  a "Replaying a previously documented incident." banner — demo data is never
  presented as if it were live. No traces ship by default; add your own
  JSONL files (see `scripts/flowbook-hook.mjs`'s event shapes) to use it.
- **Story / Storyboard** — a narrative view built from real
  `agent.started`/`decision.declared`/`validation.*`/`task.completed`
  events (`shared/story.ts`). Storyboard mode is populated automatically,
  no agent involvement required (`shared/auto-storyboard.ts` derives one
  plain description per real beat); an agent can optionally enrich any
  beat with a fuller account via `.github/skills/event-storyboard`, which
  always wins over the auto entry for that beat.
- **Workspace** — a map of the watched repo's real high-level members --
  not just monorepo packages: also plain folders, or a repo's own explicitly
  declared structure (book chapters, doc sections, anything else), including
  real declared hierarchy -- overlaid with whichever session is in view:
  which members it actually touched, and any causal links an agent
  explicitly declared (e.g. "changed the web-component's prop API, which
  required updating its React wrapper"). See [Workspace Map](#workspace-map)
  below.
- **Repository** — a live-read catalog of the actual authored agents, Skills,
  prompts, and repo members in the watched repo's `.github/`, so you can see
  what specialization exists independent of whether it's been used yet.
- **Compare** — pick two recorded sessions and see their metrics side by
  side (duration, tool calls, files touched, subagents, skills, validation
  failures, repair loops). Every number is derived deterministically from
  the event log — nothing here is invented by an LLM.

A single VS Code chat session can span many unrelated tasks. Any mode with
a non-empty run filter (a dropdown that appears once at least one
`run.started` event has been declared -- see `mcp/tools/startRun.ts`) lets
you scope every panel/view down to just one declared run's events, instead
of the whole session's history. Call it sparingly, at real task
boundaries -- see `.github/instructions/observability.instructions.md`.

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

1. **Hooks** (`scripts/flowbook-hook.mjs`, wired into the
   *watched* repo's `.github/hooks/flowbook.json` by
   `flowbook init`) fire on 8 VS Code agent lifecycle events
   (session start, prompt received, pre/post tool use, subagent start/stop,
   pre-compact, stop). The script normalizes each into a `FlowbookEvent`,
   appends it to that repo's `.flowbook/sessions/<sessionId>.jsonl`, and
   best-effort notifies the live collector over HTTP.
2. **The MCP server** (`mcp/server.ts`, wired into the watched repo's
   `.vscode/mcp.json` by `flowbook init`) exposes `trace_decision`,
   `record_story_beat`, `discover_workspaces`, `link_workspaces`,
   `handoff_agent`, and `start_run` -- the deliberate, structured places an
   agent can *declare* a decision, story beat, causal link between two
   workspace packages, agent handoff, or the start of a new run, always
   tagged `evidence: "declared"`, never confused with something observed.
   Every tool call is itself an observed `mcp.tool.called` event. A
   consuming repo can register its own additional domain-specific MCP
   tools/resources alongside these.
3. **The collector** (`server/collector.ts`) validates, redacts secrets from,
   persists, and re-broadcasts events over SSE to any connected dashboard.
   It reads/writes the *watched* repo's `.flowbook/`, `.github/`, and
   `demo/` directories (see `shared/paths.ts`'s `REPO_ROOT`), which is the
   directory `flowbook start` was pointed at -- not this package's
   own installation directory.

Every writer that runs outside the main server process (the hook script, the
MCP server) persists to its own JSONL file directly and only uses the
network purely to notify a live dashboard — so a dashboard that isn't open
never causes data loss, and a running collector never causes duplicate
events.

---

## Workspace Map

Not every repo is a monorepo. The Workspace Map's data model is "members"
-- packages, folders, files, book chapters, or anything else a repo's own
structure actually consists of -- discovered from one of three real
sources, tried in order, whichever produces something first:

| Source | How | When it applies |
|---|---|---|
| `config` | The repo's own `flowbook.members.json` | Whenever the repo has one -- the only source that can express real hierarchy or non-code members. Authored by the **`cartographer`** agent (or by hand) via the **`.github/skills/map-members`** Skill. |
| `package-manager` | `package.json` `workspaces` / `pnpm-workspace.yaml`, mechanical | A real npm/yarn/pnpm monorepo with no explicit config yet. |
| `folder-heuristic` | One member per top-level directory | Last resort -- a plain app or content repo nobody has mapped yet. |

A member can declare a real parent (`parentId`) -- e.g. a book's Part One
containing Chapter 1/2/3, or a component package containing a named
sub-component -- and the map renders that as real hierarchy, not a flat
list. A member with no declared children still shows what changed inside
it: touched files this session render as small synthetic leaf nodes
underneath it (session-scoped, not persisted -- purely a view of "here's
what changed inside this member," per the exact example from the original
request: modify `MyComponent` inside a workspace, and the workspace node
shows that change hanging off it).

Five edge kinds are drawn, and never conflated:

| Edge | Source | Meaning |
|---|---|---|
| gray solid | `shared/workspace-graph.ts`, mechanical/declared | A real dependency between two members. Always present, computed fresh every request, never edited by hand. |
| gray dotted | declared `parentId` | Real containment -- this member is a child of that one. |
| violet dotted | synthesized this session | A touched file, shown hanging off its member because that member has no declared children of its own. |
| blue dashed | `shared/workspace-activity.ts`, observed | Both members were touched (real `file.read`/`file.written` events) in the session currently in view. This is **co-occurrence only** -- it never implies one change caused the other. |
| amber solid | `workspace.linked` event, declared | An agent explicitly said, with a reason, that changing member A required changing member B (e.g. "renamed a prop on the web component, which required updating the React wrapper's types"). |

The mechanical/config graph and the co-occurrence overlay require nothing
from the agent -- they're always there once discovery produces anything.
The amber "why" edges only appear when an agent calls the `link_workspaces`
MCP tool, which the **`.github/skills/workspace-map`** Skill (scaffolded
into every watched repo by `flowbook init`) guides an agent to do
honestly at the end of a session that touched more than one member --
including the discipline of *not* declaring a link when two members were
merely both touched for unrelated reasons. Click any member node to see
exactly which files were read/written there and any links in or out of it.

The **`cartographer`** agent (also scaffolded by `init`) is the one
specifically responsible for deciding whether a repo needs its own
`flowbook.members.json` at all -- most repos are fine on
`package-manager`/`folder-heuristic` alone; the Cartographer's job is
noticing when they aren't (real hierarchy, non-code members, structure no
package manager can express) and writing the config, using
`.github/skills/map-members` as its authoring reference.

Before any of this is narrated or linked, run **`.github/skills/interpret-session`**
-- it reconciles the event log against the repo's real current state
(`git status`/`git diff`) so a `file.written` that was later reverted, or a
real change with no matching event, doesn't get treated as ground truth by
`event-storyboard` or `workspace-map`.

---

## Project layout

```text
bin/        the `flowbook` CLI (start/init) and the MCP launcher
shared/     event schema (Zod), JSONL event store, redaction, metrics, path
            resolution (REPO_ROOT vs PACKAGE_ROOT), member graph discovery
            and session-activity computation — used by both server and MCP
            server (and read-only by the frontend)
server/     Express collector/API: ingest, SSE stream, replay, repo introspection,
            narrative storage, workspace graph/activity API, static dashboard
            serving when packaged
mcp/        MCP server: decision telemetry (trace_decision, record_story_beat)
            workspace telemetry (discover_workspaces, link_workspaces),
            agent-handoff telemetry (handoff_agent), and run telemetry
            (start_run)
scripts/    the VS Code hook script (flowbook-hook.mjs)
src/        React + Vite dashboard
demo/       prerecorded demo traces (JSONL); empty by default
tests/      vitest suite
.github/    this repo's own agents (including `cartographer`) and Skills
            (including event-storyboard/workspace-map/
            map-members/interpret-session/agent-handoff), all copied into
            every watched repo by `flowbook init`, plus prompts,
            scoped instructions, hook wiring
```

A repo you point Flowbook at only needs `flowbook init`
to have run once; it gains its own `.github/hooks/flowbook.json`,
`.vscode/mcp.json`, `.github/agents/cartographer.agent.md`,
`.github/skills/{event-storyboard,workspace-map,map-members,interpret-session,agent-handoff}/`,
and (once a session runs) `.flowbook/`. A repo can also define its own
`flowbook.members.json` at its root (see [Workspace Map](#workspace-map))
to make the map's structure explicit rather than relying on mechanical
discovery.

More detail on how the pieces fit together: [docs/architecture.md](docs/architecture.md).
