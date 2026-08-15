import { describe, it, expect } from "vitest";
import { computeSessionMetrics } from "../shared/metrics.js";
import { createEvent } from "../shared/events.js";
import type { AgentariumEvent } from "../shared/events.js";

function at(iso: string, overrides: Partial<Parameters<typeof createEvent>[0]>): AgentariumEvent {
  return createEvent({
    sessionId: "s1",
    type: "hook.started",
    source: "hook",
    evidence: "observed",
    label: "event",
    timestamp: iso,
    ...overrides,
  } as Parameters<typeof createEvent>[0]);
}

describe("computeSessionMetrics", () => {
  it("returns zeroed metrics for an empty event list", () => {
    const metrics = computeSessionMetrics([]);
    expect(metrics.eventCount).toBe(0);
    expect(metrics.durationMs).toBe(0);
    expect(metrics.finalStatus).toBe("in-progress");
  });

  it("computes duration from first to last event", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "session.started" }),
      at("2026-01-01T00:00:30.000Z", { type: "task.completed" }),
    ];
    const metrics = computeSessionMetrics(events);
    expect(metrics.durationMs).toBe(30_000);
    expect(metrics.finalStatus).toBe("completed");
  });

  it("counts distinct agents, files, and tools", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", {
        type: "agent.started",
        actor: { id: "mote", kind: "agent", name: "Mote" },
      }),
      at("2026-01-01T00:00:01.000Z", {
        type: "subagent.started",
        actor: { id: "noor-1", kind: "subagent", name: "Noor" },
      }),
      at("2026-01-01T00:00:02.000Z", {
        type: "file.read",
        source: "filesystem",
        metadata: { path: "world/float.json" },
      }),
      at("2026-01-01T00:00:03.000Z", {
        type: "file.written",
        source: "filesystem",
        metadata: { path: "world/corrections.json" },
      }),
      at("2026-01-01T00:00:04.000Z", {
        type: "tool.completed",
        metadata: { tool: "editFiles" },
      }),
    ];
    const metrics = computeSessionMetrics(events);
    expect(metrics.agentsUsed).toEqual(["Mote"]);
    expect(metrics.subagentsSpawned).toBe(1);
    expect(metrics.filesRead).toEqual(["world/float.json"]);
    expect(metrics.filesWritten).toEqual(["world/corrections.json"]); 
    expect(metrics.toolsUsed).toEqual(["editFiles"]);
    expect(metrics.toolCallCount).toBe(1);
  });

  it("counts exactly one repair loop for a fail-then-pass sequence", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "validation.failed" }),
      at("2026-01-01T00:00:01.000Z", { type: "validation.failed" }),
      at("2026-01-01T00:00:02.000Z", { type: "validation.passed" }),
    ];
    const metrics = computeSessionMetrics(events);
    expect(metrics.validationFailures).toBe(2);
    expect(metrics.validationPasses).toBe(1);
    expect(metrics.repairLoops).toBe(1);
  });

  it("marks final status failed when the last validation never recovered", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "validation.failed" }),
    ];
    const metrics = computeSessionMetrics(events);
    expect(metrics.finalStatus).toBe("failed");
  });

  it("tracks skill access and inferred skill usage separately", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", {
        type: "skill.accessed",
        metadata: { skill: "municipal-law" },
      }),
      at("2026-01-01T00:00:01.000Z", {
        type: "skill.inferred",
        evidence: "inferred",
        metadata: { skill: "temporal-physics" },
      }),
    ];
    const metrics = computeSessionMetrics(events);
    expect(metrics.skillsAccessed).toEqual(["municipal-law"]);
    expect(metrics.skillsInferred).toEqual(["temporal-physics"]);
  });
});
