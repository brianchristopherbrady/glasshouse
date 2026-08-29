# Architecture

## Overview

```mermaid
flowchart LR
    subgraph Repo["Watched repo (any repo -- this repo's own when developing it)"]
      Config[flowbook.config.mjs -- workflows glob list]
      Modules[workflow modules -- registerWorkflow() on import]
    end

    subgraph Core["packages/core (Express, :4317) -- spawned by `flowbook start --repo <path>`"]
      Discovery[server/runner/discovery.ts]
      Registry[server/runner/registry.ts]
      Engine[server/runner/engine.ts]
      RunStore[(.flowbook/runs/*.json, .flowbook/artifacts/*)]
      Routes[runnerRoutes.ts -- /api/runner/*]
      SSE[GET /api/runner/stream]
    end

    subgraph UI["packages/ui (React + Vite dev, or dist/ when packaged)"]
      Workflow[Workflow screen: Explorer / Blueprint / Run / Compare]
    end

    Config --> Discovery
    Discovery -->|dynamic import| Modules
    Modules -->|registerWorkflow| Registry
    Routes --> Registry
    Routes -->|POST /api/runner/runs| Engine
    Engine -->|real Spans| RunStore
    Engine -->|live updates| SSE
    SSE --> Workflow
    Routes --> Workflow
```

`packages/core/shared/paths.ts` is what makes this repo-agnostic:
`REPO_ROOT` (the repo being explored, from `FLOWBOOK_REPO_ROOT`/cwd) is
where `flowbook.config.mjs` and `.flowbook/` are read/written;
`PACKAGE_ROOT` (this package's own install directory) is only used to find
the built dashboard (`dist/`) to serve statically. They're the same
directory only when running this repo's own `npm start`.

---

## The domain model (`packages/core/shared/flowbook-types.ts`)

Everything is a Zod-validated `Resource`:

```ts
type Resource =
  | WorkflowResource
  | AgentResource
  | PromptResource
  | InstructionResource
  | SkillResource
  | ToolResource
  | ArtifactResource
  | EvaluationResource
  | HumanGateResource;
```

Relationships between resources are semantic, not anonymous arrows:

```ts
type RelationshipType =
  | "references" | "uses" | "invokes" | "reads" | "writes"
  | "modifies" | "produces" | "validates" | "handsOff"
  | "branchesTo" | "dependsOn";
```

A `Blueprint` is one workflow's full declared architecture (its
`resources` + `relationships`) -- stable across runs, read straight from
the workflow's own registration, nothing inferred or scanned from prose.

A `Run` is one real execution: `{id, workflowId, scenarioId?, input,
startedAt, endedAt?, status, spans}`. A `Span` mirrors conventional
trace/span shapes (`id`, `traceId`, `parentId?`, `resourceId?`, `kind`,
`label`, `startTime`, `endTime?`, `input?`, `output?`, `status`) so it
composes with the wider observability ecosystem rather than inventing a
proprietary telemetry model.

---

## Repository discovery (`shared/flowbook-config.ts`, `shared/glob.ts`, `server/runner/discovery.ts`)

A repo declares its own workflow modules in `flowbook.config.mjs`:

```js
export default {
  workflows: ["src/workflows/**/*.workflow.ts"],
};
```

`loadFlowbookConfig()` reads this file (returns `null`, not an error, when
absent -- a repo with no config just uses whatever's already registered
elsewhere, e.g. this package's own built-in demo workflow).
`expandFileGlob()` is a hand-rolled `*`/`**` file-glob matcher (skips
`node_modules`). `discoverWorkflows()` ties them together: expand every
`workflows` pattern, dynamically `import()` each matched file purely for
its `registerWorkflow()` side effect. **Per-file import errors are caught
and isolated** -- logged, skipped -- so one broken workflow module never
prevents every other real, working workflow from loading. This runs once
at server startup, before `app.listen()`.

This is deliberately narrow: only workflow-module discovery. A workflow's
own `resources: [...]` array is still where agents/prompts/skills/tools
are declared -- there's no separate agents/skills/prompts glob list (see
`docs/flowbook-vision.md`'s Known Gaps for what plan.md sketches beyond
this).

---

## The registry (`server/runner/registry.ts`)

In-memory `Map<workflowId, RegisteredWorkflow>`, populated by
`registerWorkflow()` calls (built-in workflows via a static import in
`server/runner/index.ts`; discovered ones via `discoverWorkflows()`).
`getBlueprint(workflowId)` returns exactly what's registered -- no
inference. `listScenarios(workflowId)` returns the workflow's own
declared, reproducible input configs (the Storybook "story" equivalent).

---

## The orchestrator (`server/runner/engine.ts`)

`startRun({workflowId, scenario?, input?, storeDir?})` returns immediately
with `{run, whenDone}` -- the `run` starts at `status: "running"` with zero
spans, so `POST /api/runner/runs` never blocks on actual execution (which
continues in the background). `executeRun()` is the blocking
await-to-completion wrapper used by tests.

Inside a workflow's `run(ctx)` function, `ctx.span(kind, label, fn, opts?)`
is the only primitive: it creates a real `Span` (real `Date.now()` start
time), pushes it immediately (so "running" is visible live via SSE), runs
`fn`, then closes the span with real success/failure based on whether `fn`
actually threw. A workflow can genuinely branch on a real evaluation's
result -- see `workflows/document-refactor`'s repair loop: a real
accessibility check genuinely fails, the Builder genuinely re-edits the
real file, the check genuinely passes on the second attempt. Nothing here
is a scripted animation standing in for real branching logic.

`RunContext.storeDir` defaults to `.flowbook/` but is overridable, so
tests never touch real on-disk state.

## Real per-run artifacts (`server/runner/artifacts.ts`)

Each Run gets its own sandbox directory (`.flowbook/artifacts/<runId>/`),
seeded by copying the workflow's own `fixtures/` directory -- so a
workflow can genuinely read/write real files without ever touching the
actual repo Flowbook is running in. `shared/text-diff.ts` is a real
LCS-based line diff (not a fabricated `+N/-M` count) used for both the
`modify-document` skill's own span output and the Artifact Diff panel's
"View Diff" (`GET /api/runner/runs/:runId/artifact-diff/*`, which diffs
the workflow's pristine `fixtures/` against the run's real
post-execution artifact).

---

## Live streaming (`server/runner/runBus.ts`, `GET /api/runner/stream`)

Every `ctx.span()` push/close call also calls `publishRunUpdate()`, an
in-process pub/sub. `GET /api/runner/stream` is a Server-Sent Events
endpoint that re-broadcasts every update to connected browsers.
`packages/ui/src/runner/useRunStream.ts` subscribes and feeds updates into
`packages/ui/src/runner/runStore.ts` (Zustand). A real ordering
subtlety: a fast workflow can finish (and its SSE update arrive) *before*
the `POST /api/runner/runs` HTTP response resolves with its own "just
started" snapshot -- `runStore.ts`'s `isStale()` guard makes run-state
updates commutative regardless of arrival order, so a stale snapshot never
regresses progress SSE already delivered.

---

## The frontend (`packages/ui/src/workflow/`)

One screen, no other mode:

- **`Explorer.tsx`** -- reads `GET /api/runner/explorer`
  (`runnerRoutes.ts`'s aggregation of every registered workflow's own
  declared resources, grouped by kind, plus scenarios and recent runs).
  Real fuzzy search (substring + subsequence match). Clicking an item
  drives the same selection state the graph/Inspector already use.
- **`BlueprintGraph.tsx`** -- real `elkjs` layered layout
  (`elkLayout.ts`), plain positioned divs + SVG lines (no drag/pan/zoom
  canvas -- "code remains the source of truth"), live status rings sourced
  from the active Run's spans (latest-wins, "running" always wins over any
  terminal state so a repair-loop's second attempt shows correctly).
- **`SequenceView.tsx`** / **`WaterfallView.tsx`** -- alternate Run
  visualizations (UML actor-lane diagram; latency Gantt chart), both
  driven directly by a Run's own `startTime`/`endTime`/`parentId`/
  `resourceId` fields.
- **`PromptInspector.tsx`** -- Template vs. Resolved (Monaco), where
  Resolved is the exact substituted text a `prompt`-kind Span actually
  captured for a specific run (`shared/prompt-template.ts`'s
  `renderTemplate()`), never a re-simulation.
- **`HandoffInspector.tsx`** -- a handoff span's real
  `contextTransferred` list rendered as an included/excluded checklist.
- **`ArtifactDiffPanel.tsx`** -- real before/after diff with +/- hunks.
- **`WorkflowView.tsx`** -- Controls (workflow/scenario picker, editable
  JSON input seeded from the scenario, ▶ Run), the Blueprint/Run/Compare
  mode tabs, the Trace timeline, and the Inspector -- ties everything
  above together.

State split deliberately: TanStack Query for server-state (Blueprint/
Scenario/workflow-list lookups), Zustand (`runStore.ts`) for the
live-accumulating Run + UI selection -- two different tools for two
different kinds of state, not one library doing both jobs.

---

## Known gaps

See [docs/flowbook-vision.md](../docs/flowbook-vision.md) for the
up-to-date list of what plan.md describes that isn't built yet (Compare
mode content, Replay/forking, semantic zoom, source provenance links,
framework adapters, a VS Code extension, a command palette).
