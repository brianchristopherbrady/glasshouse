import { describe, it, expect } from "vitest";
import { compareRuns } from "../shared/compare-runs.js";
import type { Run, Span } from "../shared/flowbook-types.js";

function makeSpan(overrides: Partial<Span>): Span {
  return {
    id: overrides.id ?? "span-1",
    traceId: "trace-1",
    kind: "agent",
    label: "Builder Agent",
    startTime: 0,
    endTime: 10,
    status: "success",
    ...overrides,
  };
}

function makeRun(overrides: Partial<Run>): Run {
  return {
    id: "run-1",
    workflowId: "document-refactor",
    input: {},
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    status: "success",
    spans: [],
    ...overrides,
  };
}

describe("compareRuns", () => {
  it("summarizes each run's real duration and span count", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1" })] });
    const b = makeRun({ id: "b", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:00:02.000Z", spans: [] });
    const cmp = compareRuns(a, b);
    expect(cmp.a.durationMs).toBe(1000);
    expect(cmp.a.spanCount).toBe(1);
    expect(cmp.b.durationMs).toBe(2000);
    expect(cmp.b.spanCount).toBe(0);
  });

  it("marks a span present in both runs with the same status as unchanged", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1", resourceId: "builder", status: "success" })] });
    const b = makeRun({ id: "b", spans: [makeSpan({ id: "s2", resourceId: "builder", status: "success" })] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans).toHaveLength(1);
    expect(cmp.spans[0]!.change).toBe("unchanged");
  });

  it("marks a span whose status differs between runs as status-changed", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1", resourceId: "tests", status: "failure" })] });
    const b = makeRun({ id: "b", spans: [makeSpan({ id: "s2", resourceId: "tests", status: "success" })] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans[0]!.change).toBe("status-changed");
    expect(cmp.spans[0]!.a?.status).toBe("failure");
    expect(cmp.spans[0]!.b?.status).toBe("success");
  });

  it("marks a span only present in run A as removed", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1", resourceId: "auditor" })] });
    const b = makeRun({ id: "b", spans: [] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans[0]!.change).toBe("removed");
    expect(cmp.spans[0]!.b).toBeUndefined();
  });

  it("marks a span only present in run B as added", () => {
    const a = makeRun({ id: "a", spans: [] });
    const b = makeRun({ id: "b", spans: [makeSpan({ id: "s1", resourceId: "auditor" })] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans[0]!.change).toBe("added");
    expect(cmp.spans[0]!.a).toBeUndefined();
  });

  it("pairs the Nth occurrence of a repeated resourceId (repair loop) with the Nth in the other run, not a mismatched one", () => {
    const a = makeRun({
      id: "a",
      spans: [
        makeSpan({ id: "s1", resourceId: "builder", startTime: 0, status: "success" }),
        makeSpan({ id: "s2", resourceId: "builder", startTime: 10, status: "success" }),
      ],
    });
    const b = makeRun({
      id: "b",
      spans: [makeSpan({ id: "s3", resourceId: "builder", startTime: 0, status: "success" })],
    });
    const cmp = compareRuns(a, b);
    const builderEntries = cmp.spans.filter((s) => s.key.startsWith("builder#"));
    expect(builderEntries).toHaveLength(2);
    expect(builderEntries[0]!.change).toBe("unchanged"); // first attempt matched
    expect(builderEntries[1]!.change).toBe("removed"); // second attempt (repair loop) has no counterpart in B
  });

  it("falls back to kind:label keying for spans with no resourceId", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1", kind: "workflow", label: "Document Refactor" })] });
    const b = makeRun({ id: "b", spans: [makeSpan({ id: "s2", kind: "workflow", label: "Document Refactor" })] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans[0]!.change).toBe("unchanged");
    expect(cmp.spans[0]!.key).toBe("workflow:Document Refactor#0");
  });

  it("preserves run A's real execution order before appending B-only spans", () => {
    const a = makeRun({
      id: "a",
      spans: [
        makeSpan({ id: "s1", resourceId: "first", startTime: 0 }),
        makeSpan({ id: "s2", resourceId: "second", startTime: 10 }),
      ],
    });
    const b = makeRun({ id: "b", spans: [makeSpan({ id: "s3", resourceId: "third", startTime: 0 })] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans.map((s) => s.key.split("#")[0])).toEqual(["first", "second", "third"]);
  });

  it("leaves durationMs undefined for a still-running span", () => {
    const a = makeRun({ id: "a", spans: [makeSpan({ id: "s1", resourceId: "builder", endTime: undefined, status: "running" })] });
    const b = makeRun({ id: "b", spans: [] });
    const cmp = compareRuns(a, b);
    expect(cmp.spans[0]!.a?.durationMs).toBeUndefined();
  });
});
