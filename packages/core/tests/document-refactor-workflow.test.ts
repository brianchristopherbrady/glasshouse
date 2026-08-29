// Tests the real "Document Refactor" workflow end to end: real file edits,
// a real evaluation, and a real repair loop for the failure-injection
// scenario -- not mocked branching. Uses a temp storeDir so no real
// .flowbook/ state is touched.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import "../server/runner/workflows/document-refactor/index.js";
import { executeRun } from "../server/runner/engine.js";
import { listScenarios } from "../server/runner/registry.js";
import { artifactRootFor, readArtifact } from "../server/runner/artifacts.js";

describe("document-refactor workflow", () => {
  let storeDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "flowbook-doc-refactor-test-"));
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
  });

  it("happy path: succeeds on the first attempt with no repair loop", async () => {
    const scenario = listScenarios("document-refactor").find((s) => s.id === "happy-path")!;
    const run = await executeRun({ workflowId: "document-refactor", scenario, storeDir });

    expect(run.status).toBe("success");
    // Exactly one Builder agent span (no repair-loop second attempt).
    expect(run.spans.filter((s) => s.label === "Builder Agent")).toHaveLength(1);
    expect(run.spans.some((s) => s.kind === "handoff")).toBe(true);
    expect(run.spans.some((s) => s.label === "Auditor Agent")).toBe(true);

    const content = await readArtifact(artifactRootFor(run.id, storeDir), "button.md");
    expect(content).toContain("## Accessibility");
    expect(content).toContain("ariaLabel");
  });

  it("missing-accessibility-section scenario: fails once, genuinely repairs the real file, then passes", async () => {
    const scenario = listScenarios("document-refactor").find((s) => s.id === "missing-accessibility-section")!;
    const run = await executeRun({ workflowId: "document-refactor", scenario, storeDir });

    expect(run.status).toBe("success");
    // Two Builder attempts: the first omits the section, the second repairs it.
    expect(run.spans.filter((s) => s.label === "Builder Agent")).toHaveLength(2);
    const evaluations = run.spans.filter((s) => s.kind === "evaluation");
    expect(evaluations).toHaveLength(2);
    expect(evaluations[0]!.status).toBe("failure");
    expect(evaluations[1]!.status).toBe("success");

    const content = await readArtifact(artifactRootFor(run.id, storeDir), "button.md");
    expect(content).toContain("## Accessibility");
  });

  it("each run gets an isolated artifact sandbox -- one run's edits never leak into another's", async () => {
    const scenario = listScenarios("document-refactor").find((s) => s.id === "happy-path")!;
    const runA = await executeRun({ workflowId: "document-refactor", scenario, storeDir });
    const runB = await executeRun({ workflowId: "document-refactor", scenario, storeDir });

    expect(runA.id).not.toBe(runB.id);
    const contentA = await readArtifact(artifactRootFor(runA.id, storeDir), "button.md");
    const contentB = await readArtifact(artifactRootFor(runB.id, storeDir), "button.md");
    expect(contentA).toBe(contentB); // same scenario, deterministic real output
  });
});
