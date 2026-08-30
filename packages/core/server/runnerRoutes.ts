// HTTP API for Flowbook's real orchestrator: Blueprint discovery, Scenario
// listing, starting a Run (execution), and reading back persisted Runs.
// Namespaced under /api/runner/* to avoid colliding with the pre-existing
// /api/current-run (a different, older concept: shared/runs.ts's per-session
// task-boundary "run", not a workflow execution).
import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startRun, RunFailure } from "./runner/engine.js";
import { getWorkflow, getBlueprint, listScenarios, listWorkflows } from "./runner/registry.js";
import { artifactRootFor } from "./runner/artifacts.js";
import { listRuns, readRun } from "./runner/runStore.js";
import { diffLines } from "../shared/text-diff.js";
import { compareRuns } from "../shared/compare-runs.js";
import type { ResourceKind } from "../shared/flowbook-types.js";

export const runnerRouter = Router();

runnerRouter.get("/api/runner/workflows", (_req, res) => {
  const workflows = listWorkflows().map((w) => ({ id: w.id, label: w.label }));
  res.json({ workflows });
});

// Aggregates every registered workflow's own declared resources/scenarios
// (never scanned/inferred) into one grouped structure for the Explorer
// panel, plus recent runs -- so the UI can browse the whole repo's
// resources without fetching each workflow's Blueprint one at a time.
runnerRouter.get("/api/runner/explorer", async (_req, res) => {
  const workflows = listWorkflows();
  const resourcesByKind: Partial<Record<ResourceKind, { id: string; label: string; workflowId: string }[]>> = {};
  for (const workflow of workflows) {
    for (const resource of workflow.resources) {
      const bucket = (resourcesByKind[resource.kind] ??= []);
      bucket.push({ id: resource.id, label: resource.label, workflowId: workflow.id });
    }
  }
  const recentRuns = (await listRuns()).slice(0, 20).map((r) => ({
    id: r.id,
    workflowId: r.workflowId,
    status: r.status,
    startedAt: r.startedAt,
  }));
  res.json({
    workflows: workflows.map((w) => ({
      id: w.id,
      label: w.label,
      scenarios: w.scenarios.map((s) => ({ id: s.id, label: s.label })),
    })),
    resourcesByKind,
    recentRuns,
  });
});

runnerRouter.get("/api/runner/workflows/:workflowId/blueprint", (req, res) => {
  const blueprint = getBlueprint(req.params.workflowId);
  if (!blueprint) {
    res.status(404).json({ error: `Unknown workflow: ${req.params.workflowId}` });
    return;
  }
  res.json({ blueprint });
});

runnerRouter.get("/api/runner/workflows/:workflowId/scenarios", (req, res) => {
  res.json({ scenarios: listScenarios(req.params.workflowId) });
});

runnerRouter.post("/api/runner/runs", async (req, res) => {
  const { workflowId, scenarioId, input } = req.body ?? {};
  if (typeof workflowId !== "string") {
    res.status(400).json({ error: "body.workflowId must be a string" });
    return;
  }
  const scenario = scenarioId ? listScenarios(workflowId).find((s) => s.id === scenarioId) : undefined;
  if (scenarioId && !scenario) {
    res.status(404).json({ error: `Unknown scenario: ${scenarioId}` });
    return;
  }

  // Respond immediately with the run in "running" state; the actual
  // execution continues in the background and streams live via
  // GET /api/runner/stream (SSE) -- a real workflow can take real time
  // (file I/O, checks), so this must not block the HTTP response.
  try {
    const { run, whenDone } = startRun({
      workflowId,
      scenario,
      input: typeof input === "object" && input !== null ? input : undefined,
    });
    whenDone.catch(() => {
      // A workflow throwing is already recorded as a real "failure" Run by
      // startRun itself -- this only prevents an unhandled rejection from
      // this fire-and-forget kickoff.
    });
    res.status(202).json({ run });
  } catch (err) {
    if (err instanceof RunFailure) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

runnerRouter.get("/api/runner/runs", async (_req, res) => {
  res.json({ runs: await listRuns() });
});

runnerRouter.get("/api/runner/runs/:runId", async (req, res) => {
  const run = await readRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: `Unknown run: ${req.params.runId}` });
    return;
  }
  res.json({ run });
});

// Real two-Run comparison (span-by-span, matched by resourceId + real
// execution order) -- see shared/compare-runs.ts for the matching logic.
runnerRouter.get("/api/runner/compare", async (req, res) => {
  const { a: idA, b: idB } = req.query;
  if (typeof idA !== "string" || typeof idB !== "string") {
    res.status(400).json({ error: "query params 'a' and 'b' (run ids) are required" });
    return;
  }
  const [runA, runB] = await Promise.all([readRun(idA), readRun(idB)]);
  if (!runA) {
    res.status(404).json({ error: `Unknown run: ${idA}` });
    return;
  }
  if (!runB) {
    res.status(404).json({ error: `Unknown run: ${idB}` });
    return;
  }
  res.json({ comparison: compareRuns(runA, runB) });
});

runnerRouter.get("/api/runner/runs/:runId/artifacts/*", async (req, res) => {
  const relativePath = (req.params as Record<string, string>)[0] ?? "";
  const root = artifactRootFor(req.params.runId);
  try {
    const content = await readFile(path.join(root, relativePath), "utf-8");
    res.json({ content });
  } catch {
    res.status(404).json({ error: "artifact not found" });
  }
});

// Real before/after diff for one artifact: "before" is read straight from
// the workflow's own pristine fixture directory (never a second copy made
// just for diffing), "after" is the run's own post-execution artifact --
// so a genuinely unmodified file always reports zero added/removed lines.
runnerRouter.get("/api/runner/runs/:runId/artifact-diff/*", async (req, res) => {
  const relativePath = (req.params as Record<string, string>)[0] ?? "";
  const run = await readRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: `Unknown run: ${req.params.runId}` });
    return;
  }
  const workflow = getWorkflow(run.workflowId);
  if (!workflow?.fixturesDir) {
    res.status(404).json({ error: "This workflow has no fixture directory to diff against" });
    return;
  }
  try {
    const [before, after] = await Promise.all([
      readFile(path.join(workflow.fixturesDir, relativePath), "utf-8"),
      readFile(path.join(artifactRootFor(req.params.runId), relativePath), "utf-8"),
    ]);
    res.json({ before, after, diff: diffLines(before, after) });
  } catch {
    res.status(404).json({ error: "artifact not found" });
  }
});
