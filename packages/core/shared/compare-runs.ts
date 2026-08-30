// Real two-Run comparison -- every number here is derived directly from
// the two Runs' own real Spans (no invented "similarity score"). Matches
// spans between runs by resourceId (falling back to `kind:label` for
// spans with no resourceId, e.g. the root "workflow" span) plus an
// occurrence index, so a repair loop that invokes the same agent twice in
// one run compares its first attempt against the other run's first
// attempt, not an arbitrary pairing.
import type { Run, RunStatus, SpanKind, SpanStatus } from "./flowbook-types.js";

export interface RunSummary {
  id: string;
  workflowId: string;
  scenarioId?: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  /** `endedAt - startedAt` in ms -- undefined only if the run hasn't ended yet. */
  durationMs?: number;
  spanCount: number;
}

export type SpanChange = "added" | "removed" | "status-changed" | "unchanged";

export interface SpanComparisonEntry {
  key: string;
  label: string;
  kind: SpanKind;
  change: SpanChange;
  a?: { status: SpanStatus; durationMs?: number };
  b?: { status: SpanStatus; durationMs?: number };
}

export interface RunComparison {
  a: RunSummary;
  b: RunSummary;
  spans: SpanComparisonEntry[];
}

function summarize(run: Run): RunSummary {
  const durationMs = run.endedAt ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime() : undefined;
  return {
    id: run.id,
    workflowId: run.workflowId,
    scenarioId: run.scenarioId,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs,
    spanCount: run.spans.length,
  };
}

interface SpanOccurrence {
  key: string;
  label: string;
  kind: SpanKind;
  status: SpanStatus;
  durationMs?: number;
}

/** Assigns each span a stable, order-independent key (resourceId, or
 * `kind:label` when there's no resourceId) plus an occurrence suffix so
 * the Nth time a resource/label recurs in one run lines up with the Nth
 * time it recurs in the other, in real execution order. */
function keyedOccurrences(run: Run): SpanOccurrence[] {
  const seenCounts = new Map<string, number>();
  return [...run.spans]
    .sort((x, y) => x.startTime - y.startTime)
    .map((span) => {
      const baseKey = span.resourceId ?? `${span.kind}:${span.label}`;
      const occurrence = seenCounts.get(baseKey) ?? 0;
      seenCounts.set(baseKey, occurrence + 1);
      return {
        key: `${baseKey}#${occurrence}`,
        label: span.label,
        kind: span.kind,
        status: span.status,
        durationMs: span.endTime !== undefined ? span.endTime - span.startTime : undefined,
      };
    });
}

/** Compares two real Runs span-by-span. Order of output follows Run A's
 * real execution order, then any spans that only exist in Run B. */
export function compareRuns(a: Run, b: Run): RunComparison {
  const occurrencesA = keyedOccurrences(a);
  const occurrencesB = keyedOccurrences(b);
  const byKeyB = new Map(occurrencesB.map((o) => [o.key, o]));
  const consumedBKeys = new Set<string>();

  const spans: SpanComparisonEntry[] = [];

  for (const oa of occurrencesA) {
    const ob = byKeyB.get(oa.key);
    if (ob) consumedBKeys.add(oa.key);
    spans.push({
      key: oa.key,
      label: oa.label,
      kind: oa.kind,
      change: !ob ? "removed" : ob.status !== oa.status ? "status-changed" : "unchanged",
      a: { status: oa.status, durationMs: oa.durationMs },
      b: ob ? { status: ob.status, durationMs: ob.durationMs } : undefined,
    });
  }

  for (const ob of occurrencesB) {
    if (consumedBKeys.has(ob.key)) continue;
    spans.push({
      key: ob.key,
      label: ob.label,
      kind: ob.kind,
      change: "added",
      b: { status: ob.status, durationMs: ob.durationMs },
    });
  }

  return { a: summarize(a), b: summarize(b), spans };
}
