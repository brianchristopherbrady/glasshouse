// Integration test for the real HTTP artifact-diff route: mounts
// runnerRoutes.ts on a real ephemeral express server and hits it with a
// real fetch, using the actual document-refactor workflow (no mocked
// registry) so the diff reflects a genuine run's real file edit.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { rm } from "node:fs/promises";
import "../server/runner/workflows/document-refactor/index.js";
import { runnerRouter } from "../server/runnerRoutes.js";
import { executeRun } from "../server/runner/engine.js";
import { listScenarios } from "../server/runner/registry.js";
import { artifactRootFor } from "../server/runner/artifacts.js";
import { DEFAULT_STORE_DIR } from "../shared/event-store.js";
import path from "node:path";

describe("GET /api/runner/runs/:runId/artifact-diff/*", () => {
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
    // Clean up the real (default-store) runs/artifacts this test created,
    // since the route reads via readRun()'s default storeDir rather than
    // an injectable one.
    await Promise.all(
      createdRunIds.flatMap((runId) => [
        rm(path.join(DEFAULT_STORE_DIR, "runs", `${runId}.json`), { force: true }),
        rm(artifactRootFor(runId), { recursive: true, force: true }),
      ]),
    );
  });

  it("404s for an unknown run", async () => {
    const res = await fetch(`${baseUrl}/api/runner/runs/does-not-exist/artifact-diff/button.md`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown run/);
  });

  it("returns a real diff for a run whose Builder genuinely modified the file", async () => {
    const scenario = listScenarios("document-refactor").find((s) => s.id === "happy-path")!;
    const run = await executeRun({ workflowId: "document-refactor", scenario });
    createdRunIds.push(run.id);
    expect(run.status).toBe("success");

    const res = await fetch(`${baseUrl}/api/runner/runs/${run.id}/artifact-diff/button.md`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.before).not.toContain("## Accessibility");
    expect(body.after).toContain("## Accessibility");
    expect(body.diff.added).toBeGreaterThan(0);
  });
});
