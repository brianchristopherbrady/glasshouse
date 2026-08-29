# Flowbook — vision + implementation status

Original spec: a Storybook-like development/documentation/execution/
debugging environment for agentic AI systems, distinguishing **Blueprint**
(what a system is designed to do) from **Run Trace** (what actually
happened on one execution), with Scenarios, Controls, live traces, run
comparison, fork/replay, and framework-agnostic adapters. Full text: see
the user's message that introduced it, or ask for the whole spec to be
pasted back if this file's summary below isn't enough.

The user confirmed all three open questions from the first pass at this
doc: **(1)** rebrand/evolve this repo in place (not a new project) --
done, see `/memories/repo` for the mechanical rename notes; **(2)** build a
**real orchestrator/execution engine**, not just an observability UI over
an external agent -- done, see `server/runner/`; **(3)** adopt the spec's
stack (Zustand, TanStack Query, ELK layout, Monaco) -- done for the first
three, Monaco is installed but not yet wired into any Prompt/Instruction
editor view.

## What's actually implemented now

This repo now has **two genuinely separate systems**, both real:

1. **Observation** (the original Agentic Glasshouse product): watches a
   real external VS Code coding agent via hooks (`scripts/flowbook-hook.mjs`)
   and MCP (`mcp/`), normalizing everything into `FlowbookEvent`
   (`shared/events.ts`). Live/Replay/Demo/Story/Storyboard/Workspace/
   Repository/Compare modes all read this.
2. **Execution** (the new Flowbook orchestrator): a real runner
   (`server/runner/engine.ts`) that executes a registered workflow
   function on demand ("press Run"), producing a genuine `Run` made of
   real `Span`s (`shared/flowbook-types.ts`) -- not a scripted animation.
   The new "Workflow" mode (`src/workflow/WorkflowView.tsx`, now the app's
   default landing tab) is Blueprint/Run/Compare over this system.

| Vision concept | Implementation |
|---|---|
| Blueprint | `server/runner/registry.ts`'s `getBlueprint()` -- exactly what a workflow's own `resources`/`relationships` arrays declare (`GET /api/runner/workflows/:id/blueprint`). |
| Scenario | `RegisteredWorkflow.scenarios` -- real, reproducible input configs (see `server/runner/workflows/document-refactor/index.ts`'s `happy-path`/`missing-accessibility-section`). |
| Run + Span | `shared/flowbook-types.ts`'s `Run`/`Span` -- real trace/span shape (id/traceId/parentId/start/end/status), produced by `ctx.span(kind, label, fn)` actually executing `fn`. |
| ▶ Run button, live trace | `POST /api/runner/runs` returns immediately (`status: "running"`), execution continues in the background, `GET /api/runner/stream` (SSE) broadcasts real Span updates as they happen -- `src/runner/useRunStream.ts` + `src/runner/runStore.ts` (Zustand) feed the UI live, no refresh needed. |
| Blueprint graph | `src/workflow/BlueprintGraph.tsx` -- real `elkjs` layered layout (`src/workflow/elkLayout.ts`), plain positioned divs+SVG lines (no drag/pan/zoom canvas -- "code remains the source of truth" for v0.1), live status rings sourced from the active Run's spans. |
| Handoff context envelope | `document-refactor`'s `handoff` span carries a real `contextTransferred` list in its output. `src/workflow/HandoffInspector.tsx` renders it as a first-class included/excluded checklist (not raw JSON) when a `handoff` span is selected. |
| Artifact diff | `shared/text-diff.ts` -- real LCS-based line diff. `GET /api/runner/runs/:runId/artifact-diff/*` diffs the workflow's pristine fixture against the run's real post-execution artifact; `src/workflow/ArtifactDiffPanel.tsx`'s "View Diff" button renders the real hunks with +/- markers. |
| Repair loop / failure branching | `document-refactor`'s `missing-accessibility-section` scenario: the first Builder attempt genuinely omits a required section, the evaluation genuinely fails, the workflow genuinely re-invokes the Builder, and the second evaluation genuinely passes. |
| Run comparison | Still only `src/panels/ComparePanel.tsx` over the OLDER `FlowbookEvent`/session model (`shared/metrics.ts`) -- not yet extended to compare two orchestrator `Run`s against each other. The Workflow screen's "compare" mode tab exists in the UI but has no content yet. |
| Fork/replay from a span | Not implemented. |
| Controls panel (model/temperature/mocks) | Real editable input: the Controls panel has a JSON textarea seeded from the selected scenario's own `input`, with Reset and "Run with changes" -- no model/temperature/mock-provider fields yet (this workflow has none to control). |
| Framework adapters (LangGraph, OpenAI Agents SDK, OTel) | Not implemented -- `server/runner/`'s workflow model is this package's own; adapting an external framework's real output into `Span`s would be a real, separate integration per framework. |
| Monaco (Template/Resolved prompt view) | Wired into `src/workflow/PromptInspector.tsx` -- `document-refactor` declares a real `prompt` resource (`implementation-prompt`) and `instruction` resource (`builder-instructions`); a real `prompt`-kind span (`shared/prompt-template.ts`'s `renderTemplate()`) captures the genuine resolved text each Builder attempt, shown read-only in Monaco alongside the static Template tab. |
| Sequence / Waterfall run views | `src/workflow/SequenceView.tsx` (UML-style actor-lane diagram) and `src/workflow/WaterfallView.tsx` (latency Gantt bars nested by `parentId`) -- both real, driven directly by a Run's own `startTime`/`endTime`/`parentId`/`resourceId` fields, selectable via the `[map][sequence][waterfall]` sub-tabs shown in Run mode. |
| Explorer (left-nav resource browser) | `src/workflow/Explorer.tsx` -- reads `GET /api/runner/explorer` (`server/runnerRoutes.ts`'s aggregation over every registered workflow's own declared resources, grouped by kind, plus each workflow's real scenarios and recent runs). Real fuzzy search (substring + subsequence match). Clicking a resource selects its owning workflow's Blueprint and the resource itself (same selection state the graph/Inspector already use); clicking a workflow or scenario switches to that workflow. Not yet a global command palette, and Runs aren't browsable from it yet (only surfaced in the aggregation payload, not rendered as a group). |
| Repository discovery / `defineFlowbook()` config | `shared/flowbook-config.ts`'s `defineFlowbook()` (identity helper for type-checking a repo's own config) + `loadFlowbookConfig()` (reads `flowbook.config.{ts,mts,mjs,js}` from the watched repo root, `null` -- not an error -- when absent). `shared/glob.ts`'s `expandFileGlob()` (hand-rolled `*`/`**` file-glob matcher, skips `node_modules`). `server/runner/discovery.ts`'s `discoverWorkflows()` ties them together: expands each configured `workflows` glob, dynamically `import()`s every matched file for its `registerWorkflow()` side effect, isolating per-file import errors (logged, skipped) so one broken workflow module never crashes server startup. Wired into `server/index.ts` before `app.listen()`. `flowbook init` now scaffolds an empty `flowbook.config.mjs` (never overwrites an existing one). Verified end-to-end against a real scratch repo (a workflow module outside this package, discovered and registered purely via config). |

## Known gaps / next slices (not started)

1. **Compare mode for Runs.** The Workflow screen has a "compare" tab with
   no content -- wire it to `GET /api/runner/runs` + a real two-Run diff
   (which spans differ, which resources newly executed/skipped, duration
   deltas), mirroring `ComparePanel.tsx`'s existing session-comparison
   pattern but over `Run`/`Span` instead of `FlowbookEvent`.
2. **A second demo workflow** with a genuine multi-agent branch (not just
   Builder/Auditor) would stress-test the Blueprint graph's layout at
   higher node counts and prove the model generalizes past one example.
3. **"Save as new scenario"** -- Scenario Controls currently support
   editing input and running with changes, but not persisting an edited
   input back as a new named `Scenario` in the registry.
4. **Config discovery is workflows-only.** `flowbook.config.*` only has a
   `workflows` glob today -- plan.md's fuller sketch (separate
   `agents`/`skills`/`prompts` glob lists, `adapters[]`) isn't implemented;
   those are still declared inline by a workflow module itself
   (`registerWorkflow({resources: [...]})`), not discovered independently.
5. **Explorer: Runs group + source provenance links.** The Explorer shows
   Workflows/Agents/Prompts/Instructions/Skills/Artifacts/Evaluations but
   not a browsable Runs list (data is fetched but unused), and no item
   links to its defining source file/line yet.
6. Framework adapters remain a real, separate, larger effort each --
   deliberately not started until there's a concrete need for a specific
   one (LangGraph vs. OpenAI Agents SDK vs. raw OTel would each be a
   different integration, not a shared abstraction worth building blind).

This file should be kept up to date as any of the above gets implemented
-- do not let it silently drift stale relative to what `server/runner/`
actually does.
