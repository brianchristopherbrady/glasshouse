// Real two-Run comparison view -- picks two persisted Runs of the current
// workflow and renders GET /api/runner/compare's real span-by-span diff
// (shared/compare-runs.ts). Every number shown (duration, span counts,
// added/removed/status-changed spans) is derived from the two Runs'
// actual recorded Spans, nothing invented.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchRunComparison } from "../api/runnerClient.js";
import type { Run } from "../../../core/shared/flowbook-types.js";
import type { SpanChange } from "../../../core/shared/compare-runs.js";

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "running…";
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRunLabel(run: Run): string {
  return `${run.id.slice(0, 8)} · ${run.status} · ${new Date(run.startedAt).toLocaleTimeString()}`;
}

const CHANGE_LABEL: Record<SpanChange, string> = {
  added: "+ added",
  removed: "− removed",
  "status-changed": "± status changed",
  unchanged: "unchanged",
};

export function ComparePanel({ workflowId }: { workflowId: string | null }) {
  const [runIdA, setRunIdA] = useState<string>("");
  const [runIdB, setRunIdB] = useState<string>("");

  const { data: runs } = useQuery({ queryKey: ["runner", "runs"], queryFn: fetchRuns });
  const runsForWorkflow = (runs ?? []).filter((r) => !workflowId || r.workflowId === workflowId);

  const { data: comparison, isLoading, error } = useQuery({
    queryKey: ["runner", "compare", runIdA, runIdB],
    queryFn: () => fetchRunComparison(runIdA, runIdB),
    enabled: !!runIdA && !!runIdB && runIdA !== runIdB,
  });

  if (runsForWorkflow.length < 2) {
    return (
      <div className="inspector-empty">
        Run this workflow at least twice to compare runs -- {runsForWorkflow.length} run{runsForWorkflow.length === 1 ? "" : "s"} recorded so far.
      </div>
    );
  }

  return (
    <div className="compare-panel">
      <div className="compare-picker-row">
        <div className="compare-picker">
          <span className="inspector-label">Run A</span>
          <select value={runIdA} onChange={(e) => setRunIdA(e.target.value)}>
            <option value="">Select a run…</option>
            {runsForWorkflow.map((r) => (
              <option key={r.id} value={r.id}>
                {formatRunLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="compare-picker">
          <span className="inspector-label">Run B</span>
          <select value={runIdB} onChange={(e) => setRunIdB(e.target.value)}>
            <option value="">Select a run…</option>
            {runsForWorkflow.map((r) => (
              <option key={r.id} value={r.id}>
                {formatRunLabel(r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {runIdA && runIdA === runIdB && <p className="microcopy">Pick two different runs to compare.</p>}
      {isLoading && <p className="microcopy">Comparing…</p>}
      {error && <p className="microcopy" style={{ color: "var(--red)" }}>{error instanceof Error ? error.message : String(error)}</p>}

      {comparison && (
        <>
          <div className="compare-summary-row">
            <div className="compare-summary-col">
              <p className="panel-title">Run A</p>
              <p className="microcopy">Status: {comparison.a.status}</p>
              <p className="microcopy">Duration: {formatDuration(comparison.a.durationMs)}</p>
              <p className="microcopy">Spans: {comparison.a.spanCount}</p>
            </div>
            <div className="compare-summary-col">
              <p className="panel-title">Run B</p>
              <p className="microcopy">Status: {comparison.b.status}</p>
              <p className="microcopy">Duration: {formatDuration(comparison.b.durationMs)}</p>
              <p className="microcopy">Spans: {comparison.b.spanCount}</p>
            </div>
          </div>

          <table className="compare-span-table">
            <thead>
              <tr>
                <th>Span</th>
                <th>Change</th>
                <th>A status / duration</th>
                <th>B status / duration</th>
              </tr>
            </thead>
            <tbody>
              {comparison.spans.map((entry) => (
                <tr key={entry.key} className={`compare-span-row change-${entry.change}`}>
                  <td>
                    {entry.label} <span className="microcopy">({entry.kind})</span>
                  </td>
                  <td>{CHANGE_LABEL[entry.change]}</td>
                  <td>{entry.a ? `${entry.a.status} · ${formatDuration(entry.a.durationMs)}` : "—"}</td>
                  <td>{entry.b ? `${entry.b.status} · ${formatDuration(entry.b.durationMs)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
