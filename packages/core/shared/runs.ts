// Derives the list of declared runs within a session's events, and filters
// an event list down to one run. A "run" is a self-reported, narrower unit
// of work than a whole session (see shared/events.ts's `run.started` type
// and mcp/tools/startRun.ts) -- purely a UI/filtering convenience layered
// on top of `metadata.runId`, which scripts/hook-pipeline.mjs stamps onto
// every event produced while a run is active. Nothing here infers a run
// boundary; it only reads what was actually declared.
import type { FlowbookEvent } from "./events.js";

export interface RunSummary {
  id: string;
  label: string;
  startedAt: string;
}

function metaStr(event: FlowbookEvent, key: string): string | undefined {
  const v = event.metadata?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Lists every run declared within a set of events, in the order they
 * started. The run's id is its `run.started` event's own id -- the same id
 * `metadata.runId` carries on every event produced while it was active. */
export function listRuns(events: FlowbookEvent[]): RunSummary[] {
  return events
    .filter((e) => e.type === "run.started")
    .map((e) => ({ id: e.id, label: e.label, startedAt: e.timestamp }));
}

/** Filters events down to just those belonging to one declared run
 * (matched via `metadata.runId`), including the run's own `run.started`
 * event. `runId === null` means "no run filter applied" (returns all
 * events unchanged). */
export function filterByRun(events: FlowbookEvent[], runId: string | null): FlowbookEvent[] {
  if (!runId) return events;
  return events.filter((e) => e.id === runId || metaStr(e, "runId") === runId);
}
