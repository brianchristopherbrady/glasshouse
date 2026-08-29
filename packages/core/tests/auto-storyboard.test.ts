import { describe, it, expect } from "vitest";
import { createEvent } from "../shared/events.js";
import { buildStoryGraph } from "../shared/story.js";
import { buildAutoStoryboard, describeBeat, mergeStoryboards } from "../shared/auto-storyboard.js";
import type { FlowbookEvent } from "../shared/events.js";
import type { Storyboard } from "../shared/narrative-types.js";

function at(iso: string, overrides: Partial<Parameters<typeof createEvent>[0]>): FlowbookEvent {
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

describe("buildAutoStoryboard", () => {
  it("produces one auto entry per real beat, skipping the synthetic root", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "agent", kind: "agent", name: "Mote" } }),
      at("2026-01-01T00:00:01.000Z", {
        type: "decision.declared",
        evidence: "declared",
        actor: { id: "agent", kind: "agent", name: "Mote" },
        label: "Decided to delegate",
        metadata: { reason: "boundaries changed" },
      }),
    ];
    const graph = buildStoryGraph(events);
    const storyboard = buildAutoStoryboard("s1", graph);

    expect(storyboard.sessionId).toBe("s1");
    expect(storyboard.beats).toHaveLength(2);
    expect(storyboard.beats.every((b) => b.source === "auto")).toBe(true);
    expect(storyboard.beats.some((b) => b.beatId === graph.rootId)).toBe(false);
  });

  it("returns an empty beats array for an empty event list", () => {
    const graph = buildStoryGraph([]);
    const storyboard = buildAutoStoryboard("s1", graph);
    expect(storyboard.beats).toEqual([]);
  });
});

describe("describeBeat", () => {
  it("builds a thin description for a beat with no reason/next/effects", () => {
    const events = [at("2026-01-01T00:00:00.000Z", { type: "agent.started", actor: { id: "a", kind: "agent" } })];
    const graph = buildStoryGraph(events);
    const beat = [...graph.beats.values()].find((b) => b.kind === "agent")!;
    expect(describeBeat(beat)).toBe(beat.title);
  });

  it("includes the declared reason, next step, and unresolved note when present", () => {
    const events = [
      at("2026-01-01T00:00:00.000Z", {
        type: "decision.declared",
        evidence: "declared",
        label: "Decided X",
        metadata: { reason: "because Y", next: "do Z" },
      }),
    ];
    const graph = buildStoryGraph(events);
    const beat = [...graph.beats.values()].find((b) => b.kind === "decision")!;
    const desc = describeBeat(beat);
    expect(desc).toContain("Reason: because Y.");
    expect(desc).toContain("Declared next step: do Z.");
    expect(desc).toContain("Unresolved:");
  });
});

describe("mergeStoryboards", () => {
  it("returns the auto storyboard unchanged when there is no agent storyboard", () => {
    const auto: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      beats: [{ beatId: "beat:agent:a", kind: "agent", description: "auto desc", involves: [], citedEventIds: [], source: "auto" }],
    };
    const merged = mergeStoryboards(auto, null);
    expect(merged).toBe(auto);
  });

  it("lets an agent-authored entry replace the auto entry for the same beat", () => {
    const auto: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      beats: [
        { beatId: "beat:agent:a", kind: "agent", description: "auto desc", involves: [], citedEventIds: [], source: "auto" },
        { beatId: "beat:decision:b", kind: "decision", description: "auto decision desc", involves: [], citedEventIds: [], source: "auto" },
      ],
    };
    const agent: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-02T00:00:00.000Z",
      beats: [{ beatId: "beat:agent:a", kind: "agent", description: "richer agent desc", involves: ["Mote"], citedEventIds: ["evt-1"], source: "agent" }],
    };
    const merged = mergeStoryboards(auto, agent);
    const a = merged.beats.find((b) => b.beatId === "beat:agent:a")!;
    const b = merged.beats.find((b) => b.beatId === "beat:decision:b")!;
    expect(a.description).toBe("richer agent desc");
    expect(a.source).toBe("agent");
    expect(b.description).toBe("auto decision desc");
    expect(b.source).toBe("auto");
  });

  it("preserves auto beat ordering", () => {
    const auto: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      beats: [
        { beatId: "beat:1", kind: "agent", description: "first", involves: [], citedEventIds: [], source: "auto" },
        { beatId: "beat:2", kind: "decision", description: "second", involves: [], citedEventIds: [], source: "auto" },
      ],
    };
    const agent: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-02T00:00:00.000Z",
      beats: [{ beatId: "beat:2", kind: "decision", description: "enriched second", involves: [], citedEventIds: [] }],
    };
    const merged = mergeStoryboards(auto, agent);
    expect(merged.beats.map((b) => b.beatId)).toEqual(["beat:1", "beat:2"]);
  });

  it("surfaces an agent beat with no matching auto beat instead of dropping it", () => {
    const auto: Storyboard = { sessionId: "s1", generatedAt: "2026-01-01T00:00:00.000Z", beats: [] };
    const agent: Storyboard = {
      sessionId: "s1",
      generatedAt: "2026-01-02T00:00:00.000Z",
      beats: [{ beatId: "beat:stale", kind: "decision", description: "orphaned", involves: [], citedEventIds: [] }],
    };
    const merged = mergeStoryboards(auto, agent);
    expect(merged.beats).toHaveLength(1);
    expect(merged.beats[0]!.beatId).toBe("beat:stale");
  });
});
