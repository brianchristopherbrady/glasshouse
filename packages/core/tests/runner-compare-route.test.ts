// Integration test for GET /api/runner/compare: mounts runnerRoutes.ts on
// a real ephemeral express server, executes the actual document-refactor
// workflow twice under its two real scenarios (happy-path vs.
// missing-accessibility-section, which genuinely takes the repair-loop
// branch), and compares the resulting real Runs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { rm } from "node:fs/promises";
import path from "node:path";
import "../server/runner/workflows/document-refactor/index.js";
import { runnerRouter } from "../server/runnerRoutes.js";
import { executeRun } from "../server/runner/engine.js";
import { listScenarios } from "../server/runner/registry.js";
import { artifactRootFor } from "../server/runner/artifacts.js";
import { DEFAULT_STORE_DIR } from "../shared/store-dir.js";

describe("GET /api/runner/compare", () => {
  let server: Server;
  let baseUrl: string;
  const createdRunIds: string[] = [];

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(runnerRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all(
      createdRunIds.flatMap((runId) => [
        rm(path.join(DEFAULT_STORE_DIR, "runs", `${runId}.json`), { force: true }),
        rm(artifactRootFor(runId), { recursive: true, force: true }),
      ]),
    );
  });

  it("400s when either run id query param is missing", async () => {
    const res = await fetch(`${baseUrl}/api/runner/compare?a=only-one`);
    expect(res.status).toBe(400);
  });

  it("404s when a run id doesn't exist", async () => {
    const res = await fetch(`${baseUrl}/api/runner/compare?a=does-not-exist&b=also-missing`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown run/);
  });

  it("compares two real runs of the same workflow under different scenarios", async () => {
    const happyPath = listScenarios("document-refactor").find((s) => s.id === "happy-path")!;
    const repairLoop = listScenarios("document-refactor").find((s) => s.id === "missing-accessibility-section")!;

    const runA = await executeRun({ workflowId: "document-refactor", scenario: happyPath });
    const runB = await executeRun({ workflowId: "document-refactor", scenario: repairLoop });
    createdRunIds.push(runA.id, runB.id);

    const res = await fetch(`${baseUrl}/api/runner/compare?a=${runA.id}&b=${runB.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.comparison.a.id).toBe(runA.id);
    expect(body.comparison.b.id).toBe(runB.id);
    // The repair-loop run genuinely has more spans (a second Builder
    // attempt + a second evaluation) -- real data, not a fabricated count.
    expect(body.comparison.b.spanCount).toBeGreaterThan(body.comparison.a.spanCount);
    // Some span entries should be genuinely "added" (repair-loop's extra
    // attempt has no counterpart in the happy-path run).
    expect(body.comparison.spans.some((s: { change: string }) => s.change === "added")).toBe(true);
  });
});
