// Tests for the real orchestrator (server/runner/): registration, actual
// workflow execution (real spans, real file I/O in a temp sandbox), and
// the real repair-loop/failure-injection path. Uses a temp storeDir per
// .github/instructions/tests.instructions.md -- never touches the real
// .flowbook/ directory.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeRun } from "../server/runner/engine.js";
import { registerWorkflow, resetRegistryForTests, getWorkflow, getBlueprint, listScenarios } from "../server/runner/registry.js";
import { seedArtifacts, readArtifact, writeArtifact } from "../server/runner/artifacts.js";
import { readRun } from "../server/runner/runStore.js";
import type { RunContext } from "../server/runner/engine.js";

describe("registry", () => {
  afterEach(() => {
    resetRegistryForTests();
  });

  it("registers and retrieves a workflow by id", () => {
    registerWorkflow({
      id: "test-wf",
      label: "Test Workflow",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async () => {},
    });
    expect(getWorkflow("test-wf")?.label).toBe("Test Workflow");
  });

  it("returns a Blueprint built purely from the workflow's own declared resources/relationships", () => {
    registerWorkflow({
      id: "test-wf",
      label: "Test Workflow",
      resources: [{ kind: "agent", id: "a1", label: "Agent One", skills: [], tools: [], handoffs: [] }],
      relationships: [{ from: "test-wf", to: "a1", type: "invokes" }],
      scenarios: [],
      run: async () => {},
    });
    const blueprint = getBlueprint("test-wf");
    expect(blueprint?.resources).toHaveLength(1);
    expect(blueprint?.relationships).toHaveLength(1);
  });

  it("lists scenarios registered for a workflow", () => {
    registerWorkflow({
      id: "test-wf",
      label: "Test Workflow",
      resources: [],
      relationships: [],
      scenarios: [{ id: "s1", workflowId: "test-wf", label: "Scenario 1", input: {} }],
      run: async () => {},
    });
    expect(listScenarios("test-wf").map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("executeRun", () => {
  let storeDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "flowbook-runner-test-"));
    resetRegistryForTests();
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
    resetRegistryForTests();
  });

  it("throws for an unregistered workflow id", async () => {
    await expect(executeRun({ workflowId: "does-not-exist", storeDir })).rejects.toThrow(/Unknown workflow/);
  });

  it("produces a successful run with real spans reflecting what actually executed", async () => {
    registerWorkflow({
      id: "simple",
      label: "Simple Workflow",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async (ctx: RunContext) => {
        await ctx.span("agent", "Agent A", async (span) => {
          span.setOutput({ ok: true });
        });
      },
    });

    const run = await executeRun({ workflowId: "simple", storeDir });

    expect(run.status).toBe("success");
    // One root "workflow" span plus the one "agent" span the workflow itself created.
    expect(run.spans.map((s) => s.kind)).toEqual(["workflow", "agent"]);
    expect(run.spans.every((s) => s.status === "success")).toBe(true);
    expect(run.spans.find((s) => s.kind === "agent")?.output).toEqual({ ok: true });
  });

  it("nests a child span under its parent via parentId", async () => {
    registerWorkflow({
      id: "nested",
      label: "Nested Workflow",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async (ctx: RunContext) => {
        await ctx.span("agent", "Agent A", async () => {
          await ctx.span("skill", "Skill 1", async () => {});
        });
      },
    });

    const run = await executeRun({ workflowId: "nested", storeDir });
    const agentSpan = run.spans.find((s) => s.kind === "agent")!;
    const skillSpan = run.spans.find((s) => s.kind === "skill")!;
    expect(skillSpan.parentId).toBe(agentSpan.id);
  });

  it("marks the run as failure when the workflow throws, without losing already-recorded spans", async () => {
    registerWorkflow({
      id: "failing",
      label: "Failing Workflow",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async (ctx: RunContext) => {
        await ctx.span("agent", "Agent A", async () => {});
        throw new Error("boom");
      },
    });

    const run = await executeRun({ workflowId: "failing", storeDir });
    expect(run.status).toBe("failure");
    expect(run.spans.find((s) => s.kind === "agent")?.status).toBe("success");
  });

  it("marks a span itself as failure when its own callback throws", async () => {
    registerWorkflow({
      id: "span-fails",
      label: "Span Fails",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async (ctx: RunContext) => {
        await ctx.span("evaluation", "Check", async () => {
          throw new Error("check failed");
        });
      },
    });

    const run = await executeRun({ workflowId: "span-fails", storeDir });
    expect(run.status).toBe("failure");
    const evalSpan = run.spans.find((s) => s.kind === "evaluation")!;
    expect(evalSpan.status).toBe("failure");
    expect((evalSpan.output as { error: string }).error).toBe("check failed");
  });

  it("persists the completed run so it can be read back", async () => {
    registerWorkflow({
      id: "persisted",
      label: "Persisted Workflow",
      resources: [],
      relationships: [],
      scenarios: [],
      run: async () => {},
    });

    const run = await executeRun({ workflowId: "persisted", storeDir });
    const reloaded = await readRun(run.id, storeDir);
    expect(reloaded?.id).toBe(run.id);
    expect(reloaded?.status).toBe("success");
  });
});

describe("artifacts", () => {
  let storeDir: string;
  let fixturesDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "flowbook-artifacts-test-"));
    fixturesDir = await mkdtemp(path.join(os.tmpdir(), "flowbook-fixtures-test-"));
    await writeFile(path.join(fixturesDir, "doc.md"), "original content\n", "utf-8");
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
    await rm(fixturesDir, { recursive: true, force: true });
  });

  it("seeds a run's artifact sandbox from real fixture files, isolated per run", async () => {
    const root = await seedArtifacts("run-1", fixturesDir, storeDir);
    const content = await readArtifact(root, "doc.md");
    expect(content).toBe("original content\n");
  });

  it("writes are isolated to the run's own sandbox, never the fixture source", async () => {
    const root = await seedArtifacts("run-2", fixturesDir, storeDir);
    await writeArtifact(root, "doc.md", "modified content\n");

    const sandboxContent = await readArtifact(root, "doc.md");
    const fixtureContent = await readFile(path.join(fixturesDir, "doc.md"), "utf-8");
    expect(sandboxContent).toBe("modified content\n");
    expect(fixtureContent).toBe("original content\n");
  });
});
