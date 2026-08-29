# FLOWBOOK

**A Storybook for agentic AI.**

Flowbook is an interactive explorer and debugger for agentic systems. It
turns agents, prompts, instructions, skills, tools, artifacts, handoffs,
evaluations, and scenarios into an understandable, executable visual
system -- and then actually **runs** them against the real repository, not
a scripted animation.

See [plan.md](plan.md) for the full product spec and
[docs/flowbook-vision.md](docs/flowbook-vision.md) for exactly what's
implemented vs. still a gap.

The core distinction the whole product is built around:

- **Blueprint** -- what a workflow is designed to do (its declared
  agents/prompts/skills/tools/artifacts/evaluations and the relationships
  between them), read straight from a workflow's own registration.
- **Run** -- what actually happened during one real execution: a genuine
  trace made of real `Span`s (real start/end times, real status, real
  input/output), produced by the workflow's own code actually running.

---

## Quick start (any repo)

```bash
cd /path/to/the/repo/you/want/to/explore
npx flowbook init     # scaffolds an empty flowbook.config.mjs
npx flowbook start    # starts the orchestrator + dashboard, watching this repo
```

Open **http://localhost:4317**. Declare your own workflows in
`flowbook.config.mjs`'s `workflows` glob list -- any matching file that
calls `registerWorkflow()` when imported is discovered automatically (see
`packages/core/shared/flowbook-config.ts` / `server/runner/discovery.ts`).

`flowbook start` accepts:

```bash
npx flowbook start --repo /path/to/other/repo
npx flowbook start --port 4400 --client-port 5180
```

## Developing Flowbook itself

```bash
npm install
npm start
```

This runs the orchestrator/API server (port 4317) and the Vite dev client
(port 5173) together. Open **http://localhost:5173**.

```bash
npm test          # vitest
npm run build     # tsc -b && vite build (also what `npx flowbook start` serves)
```

---

## What you're looking at

The whole product is one screen: the **Workflow** view.

- **Explorer** (left) -- every resource any registered workflow declares,
  grouped by kind (Workflows/Agents/Prompts/Instructions/Skills/Tools/
  Artifacts/Evaluations), with fuzzy search. Clicking an item navigates to
  its owning workflow and selects it.
- **Controls** -- pick a workflow + scenario, edit its input as real JSON,
  then **▶ Run with changes** to actually execute it.
- **Canvas** -- the Blueprint graph (real `elkjs` layered layout) in
  Blueprint mode; live status rings once a Run starts. In Run mode, switch
  between **Map** (the same graph, overlaid with live span status),
  **Sequence** (a UML-style actor-lane diagram), and **Waterfall** (a
  latency Gantt chart) -- all driven by the same real Run/Span data.
- **Trace** -- the chronological list of real Spans as they're produced.
- **Inspector** -- click a resource or a span to see its detail: a Prompt's
  real Template vs. Resolved text (Monaco), a Handoff's real
  included/excluded context checklist, or an Artifact's **View Diff**
  (real before/after content with +/- hunks).

Every Run streams live over SSE (`GET /api/runner/stream`) the moment
`POST /api/runner/runs` starts it -- no polling, no page refresh.

---

## How a workflow becomes real

1. A workflow module calls `registerWorkflow({ id, label, resources,
   relationships, scenarios, run })` (see
   `packages/core/server/runner/workflows/document-refactor/index.ts` for
   the one built-in example). `resources`/`relationships` are the
   Blueprint -- exactly what the workflow declares, nothing inferred.
   `scenarios` are reproducible named inputs.
2. Pressing **▶ Run** calls `POST /api/runner/runs`, which calls
   `startRun()` (`packages/core/server/runner/engine.ts`). It returns
   immediately with a `status: "running"` Run and continues executing in
   the background.
3. Inside the workflow's own `run(ctx)` function, every real unit of work
   is wrapped in `ctx.span(kind, label, fn)` -- this creates a real `Span`
   with a real `Date.now()` start time, runs `fn`, and closes the span with
   real success/failure based on whether `fn` actually threw. A workflow
   can genuinely branch on a real evaluation's result (see
   `document-refactor`'s repair loop: a real accessibility check fails,
   the Builder genuinely re-edits the file, the check genuinely passes).
4. Every Span is broadcast live over `server/runner/runBus.ts` the instant
   it's created/closed, and persisted to `.flowbook/runs/<runId>.json`.

A repo declares its own workflows via `flowbook.config.mjs`'s `workflows`
glob list; `server/runner/discovery.ts` expands the globs and dynamically
imports each matched file purely for its `registerWorkflow()` side effect.
A single broken workflow module is caught, logged, and skipped -- it never
prevents every other real, working workflow from loading.

---

## Project layout

```text
packages/core/    the engine: shared domain model (shared/flowbook-types.ts),
                  the real orchestrator (server/runner/), repository
                  discovery/config (shared/flowbook-config.ts,
                  shared/glob.ts, server/runner/discovery.ts), and the
                  HTTP/SSE API server. Knows nothing about React.
packages/cli/     the `flowbook` CLI (start/init)
packages/ui/      the React + Vite browser workbench (packages/ui/src/workflow/)
docs/             flowbook-vision.md tracks implementation status vs. plan.md
```

More detail on how the pieces fit together: [docs/architecture.md](docs/architecture.md).
