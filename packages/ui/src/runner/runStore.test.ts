// Regresses a real race: startRun's HTTP POST response resolves AFTER the
// workflow (running server-side) has already finished and its SSE update
// arrived, because a fast workflow can complete in a few milliseconds --
// far less than one HTTP round trip. Without ordering protection, the
// stale "just started, zero spans" POST response would clobber the
// already-completed run the user is looking at.
import { describe, it, expect, beforeEach } from "vitest";
import { useRunStore } from "./runStore.js";
import type { Run } from "../../../core/shared/flowbook-types.js";

function makeRun(overrides: Partial<Run>): Run {
  return {
    id: "run-1",
    workflowId: "document-refactor",
    input: {},
    startedAt: new Date().toISOString(),
    status: "running",
    spans: [],
    ...overrides,
  };
}

describe("runStore", () => {
  beforeEach(() => {
    useRunStore.setState({ activeRun: null, selectedSpanId: null });
  });

  it("applyRunUpdate wins normally when it arrives after setActiveRun", () => {
    useRunStore.getState().setActiveRun(makeRun({ status: "running", spans: [] }));
    useRunStore.getState().applyRunUpdate(makeRun({ status: "success", spans: [{ id: "s1" } as never] }));
    expect(useRunStore.getState().activeRun?.status).toBe("success");
  });

  it("a stale setActiveRun snapshot never regresses a run SSE already completed", () => {
    // SSE delivers the completed run first (fast workflow)...
    useRunStore.getState().applyRunUpdate(makeRun({ status: "success", spans: [{ id: "s1" } as never] }));
    // ...then the POST response for the SAME run resolves with its
    // original "just started" snapshot.
    useRunStore.getState().setActiveRun(makeRun({ status: "running", spans: [] }));
    expect(useRunStore.getState().activeRun?.status).toBe("success");
    expect(useRunStore.getState().activeRun?.spans).toHaveLength(1);
  });

  it("a stale applyRunUpdate for the same run is ignored if it has fewer spans", () => {
    useRunStore.getState().setActiveRun(makeRun({ status: "running", spans: [{ id: "s1" } as never, { id: "s2" } as never] }));
    useRunStore.getState().applyRunUpdate(makeRun({ status: "running", spans: [{ id: "s1" } as never] }));
    expect(useRunStore.getState().activeRun?.spans).toHaveLength(2);
  });

  it("setActiveRun for a genuinely different run id always switches selection", () => {
    useRunStore.getState().applyRunUpdate(makeRun({ id: "run-1", status: "success", spans: [{ id: "s1" } as never] }));
    useRunStore.getState().setActiveRun(makeRun({ id: "run-2", status: "running", spans: [] }));
    expect(useRunStore.getState().activeRun?.id).toBe("run-2");
  });
});
