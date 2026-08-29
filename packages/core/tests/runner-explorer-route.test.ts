// Integration test for GET /api/runner/explorer: mounts runnerRoutes.ts on
// a real ephemeral express server, using the actual document-refactor
// workflow registration (no mocked registry) so the aggregation reflects
// genuinely declared resources, not a synthetic fixture.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import "../server/runner/workflows/document-refactor/index.js";
import { runnerRouter } from "../server/runnerRoutes.js";

describe("GET /api/runner/explorer", () => {
  let server: Server;
  let baseUrl: string;

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
  });

  it("groups every registered workflow's own declared resources by kind", async () => {
    const res = await fetch(`${baseUrl}/api/runner/explorer`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.workflows.some((w: { id: string }) => w.id === "document-refactor")).toBe(true);
    expect(body.resourcesByKind.agent.some((r: { id: string }) => r.id === "builder")).toBe(true);
    expect(body.resourcesByKind.prompt.some((r: { id: string }) => r.id === "implementation-prompt")).toBe(true);
    expect(body.resourcesByKind.artifact.some((r: { id: string }) => r.id === "button.md")).toBe(true);
  });

  it("includes each resource's owning workflow id, not just its own id", async () => {
    const res = await fetch(`${baseUrl}/api/runner/explorer`);
    const body = await res.json();
    const builder = body.resourcesByKind.agent.find((r: { id: string }) => r.id === "builder");
    expect(builder.workflowId).toBe("document-refactor");
  });

  it("lists each workflow's real scenarios, not an empty placeholder", async () => {
    const res = await fetch(`${baseUrl}/api/runner/explorer`);
    const body = await res.json();
    const workflow = body.workflows.find((w: { id: string }) => w.id === "document-refactor");
    expect(workflow.scenarios.map((s: { id: string }) => s.id)).toContain("happy-path");
  });
});
