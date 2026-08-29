// Gantt-chart-style latency view over a real Run's Spans -- each bar's
// position/width comes directly from the span's real startTime/endTime
// (still-running spans extend to "now"), nested by parentId depth, per
// plan.md's `[Map] [Sequence] [Waterfall]` mode requirement. No synthetic
// timing -- every bar reflects wall-clock time the orchestrator actually
// measured.
import type { Run, Span } from "../../../core/shared/flowbook-types.js";

interface Row {
  span: Span;
  depth: number;
}

function buildRows(spans: Span[]): Row[] {
  const byParent = new Map<string | undefined, Span[]>();
  for (const span of spans) {
    const list = byParent.get(span.parentId) ?? [];
    list.push(span);
    byParent.set(span.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.startTime - b.startTime);

  const rows: Row[] = [];
  function visit(parentId: string | undefined, depth: number) {
    for (const span of byParent.get(parentId) ?? []) {
      rows.push({ span, depth });
      visit(span.id, depth + 1);
    }
  }
  visit(undefined, 0);
  return rows;
}

export function WaterfallView({ run }: { run: Run }) {
  if (run.spans.length === 0) {
    return <div className="inspector-empty">No spans yet.</div>;
  }

  const rows = buildRows(run.spans);
  const minStart = Math.min(...run.spans.map((s) => s.startTime));
  const maxEnd = Math.max(...run.spans.map((s) => s.endTime ?? Date.now()));
  const totalMs = Math.max(maxEnd - minStart, 1);

  return (
    <div className="waterfall-view">
      {rows.map(({ span, depth }) => {
        const end = span.endTime ?? Date.now();
        const leftPct = ((span.startTime - minStart) / totalMs) * 100;
        const widthPct = Math.max(((end - span.startTime) / totalMs) * 100, 0.5);
        const durationLabel = span.endTime ? `${(end - span.startTime).toFixed(0)}ms` : "running…";
        return (
          <div key={span.id} className="waterfall-row" style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="waterfall-label">{span.label}</span>
            <div className="waterfall-track">
              <div
                className={`waterfall-bar status-${span.status}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${span.label} · ${durationLabel}`}
              />
            </div>
            <span className="waterfall-duration">{durationLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
