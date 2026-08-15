import { describe, it, expect } from "vitest";
import { createEvent } from "../shared/events.js";
import { buildStoryGraph, layoutStoryGraph, ancestorsOf } from "../shared/story.js";
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

describe("buildStoryGraph", () => {
  it("returns just the root beat for an empty event list", () => {
    const graph = buildStoryGraph([]);
    expect(graph.beats.size).toBe(1);
    expect(graph.beats.get(graph.rootId)?.kind).toBe("root");
  });

  it("attaches a single decision beat under the agent that made it", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "session.started", actor: { id: "system", kind: "system" } }),
      at("2026-01-01T00:00:01.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:02.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: delegate to Surveyor",
        metadata: { reason: "boundaries changed", confidence: 0.8 },
      }),
    ];
    const graph = buildStoryGraph(events);
    const agentBeat = [...graph.beats.values()].find((b) => b.kind === "agent")!;
    const decisionBeat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    expect(decisionBeat.parentId).toBe(agentBeat.id);
    expect(agentBeat.childIds).toContain(decisionBeat.id);
    expect(decisionBeat.reason).toBe("boundaries changed");
    expect(decisionBeat.confidence).toBe(0.8);
  });

  it("branches into multiple children when two subagents are summoned from the same lane", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: split investigation",
        metadata: { reason: "spans two domains" },
      }),
      at("2026-01-01T00:00:02.000Z", { type: "subagent.started", actor: { id: "surveyor-1", kind: "subagent", name: "Surveyor" } }),
      at("2026-01-01T00:00:03.000Z", { type: "subagent.started", actor: { id: "naturalist-1", kind: "subagent", name: "Naturalist" } }),
    ];
    const graph = buildStoryGraph(events);
    const decisionBeat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    expect(decisionBeat.childIds.length).toBe(2);
    const children = decisionBeat.childIds.map((id) => graph.beats.get(id)!);
    expect(children.map((c) => c.character).sort()).toEqual(["Naturalist", "Surveyor"]);
  });

  it("attributes ordinary tool/file events as effects of the most recent beat in their lane", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "file.read",
        source: "filesystem",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        metadata: { path: "world/geography.json" },
      }),
    ];
    const graph = buildStoryGraph(events);
    const agentBeat = [...graph.beats.values()].find((b) => b.kind === "agent")!;
    expect(agentBeat.effects).toHaveLength(1);
    expect(agentBeat.effects[0]!.type).toBe("file.read");
  });

  it("marks a validation.failed with no later validation.passed as unresolved", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", { type: "validation.failed", actor: { id: "system", kind: "system" } }),
    ];
    const graph = buildStoryGraph(events);
    const validationBeat = [...graph.beats.values()].find((b) => b.kind === "validation")!;
    expect(validationBeat.unresolved).toBe(true);
    expect(validationBeat.unresolvedReason).toBeTruthy();
  });

  it("does not mark validation.failed as unresolved once a later validation.passed occurs in the same lane", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", { type: "validation.failed", actor: { id: "system", kind: "system" } }),
      at("2026-01-01T00:00:02.000Z", { type: "validation.passed", actor: { id: "system", kind: "system" } }),
    ];
    const graph = buildStoryGraph(events);
    const failedBeat = [...graph.beats.values()].find((b) => b.kind === "validation" && b.sourceEvent?.type === "validation.failed")!;
    expect(failedBeat.unresolved).toBe(false);
  });

  it("marks a decision with a declared next step and no observed follow-through as unresolved", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: pause here",
        metadata: { reason: "waiting on input", next: "ask the user for clarification" },
      }),
    ];
    const graph = buildStoryGraph(events);
    const decisionBeat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    expect(decisionBeat.unresolved).toBe(true);
    expect(decisionBeat.unresolvedReason).toContain("ask the user for clarification");
  });

  it("does not mark a decision unresolved when it has a child beat even with a declared next step", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: delegate",
        metadata: { reason: "needs a specialist", next: "summon Surveyor" },
      }),
      at("2026-01-01T00:00:02.000Z", { type: "subagent.started", actor: { id: "surveyor-1", kind: "subagent", name: "Surveyor" } }),
    ];
    const graph = buildStoryGraph(events);
    const decisionBeat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    expect(decisionBeat.unresolved).toBe(false);
  });
});

describe("layoutStoryGraph", () => {
  it("centers a parent above its two children", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: split investigation",
      }),
      at("2026-01-01T00:00:02.000Z", { type: "subagent.started", actor: { id: "surveyor-1", kind: "subagent", name: "Surveyor" } }),
      at("2026-01-01T00:00:03.000Z", { type: "subagent.started", actor: { id: "naturalist-1", kind: "subagent", name: "Naturalist" } }),
    ];
    const graph = buildStoryGraph(events);
    const decisionBeat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    const positions = layoutStoryGraph(graph);
    const children = decisionBeat.childIds.map((id) => positions.get(id)!);
    const child1 = children[0]!;
    const child2 = children[1]!;
    const parentPos = positions.get(decisionBeat.id)!;
    expect(parentPos.x).toBeCloseTo((child1.x + child2.x) / 2, 5);
    expect(child1.y).toBe(child2.y);
    expect(child1.y).toBeGreaterThan(parentPos.y);
  });
});

describe("ancestorsOf", () => {
  it("returns the chain from a beat up to (excluding) the beat itself, nearest-first", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decision: delegate",
      }),
      at("2026-01-01T00:00:02.000Z", { type: "subagent.started", actor: { id: "surveyor-1", kind: "subagent", name: "Surveyor" } }),
    ];
    const graph = buildStoryGraph(events);
    const subagentBeat = [...graph.beats.values()].find((b) => b.kind === "subagent")!;
    const chain = ancestorsOf(graph, subagentBeat.id);
    expect(chain.map((b) => b.kind)).toEqual(["decision", "agent", "root"]);
  });
});
