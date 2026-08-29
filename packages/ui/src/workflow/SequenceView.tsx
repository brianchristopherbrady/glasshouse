// UML-style sequence diagram over a real Run's Spans -- actor columns (one
// per distinct resourceId that produced a span, in first-appearance order)
// with arrows drawn top-to-bottom by real startTime, per plan.md's
// `[Map] [Sequence] [Waterfall]` mode requirement. Every arrow corresponds
// to one genuine Span; nothing here is a stylized re-imagining.
import type { Run, Span } from "../../../core/shared/flowbook-types.js";

function actorFor(span: Span): string {
  return span.resourceId ?? span.kind;
}

export function SequenceView({ run }: { run: Run }) {
  const ordered = [...run.spans].sort((a, b) => a.startTime - b.startTime);
  const actors: string[] = [];
  for (const span of ordered) {
    const actor = actorFor(span);
    if (!actors.includes(actor)) actors.push(actor);
  }

  if (actors.length === 0) {
    return <div className="inspector-empty">No spans yet.</div>;
  }

  const columnWidth = 180;
  const rowHeight = 44;
  const width = actors.length * columnWidth + 40;
  const height = ordered.length * rowHeight + 60;

  function xFor(actor: string): number {
    return 20 + actors.indexOf(actor) * columnWidth + columnWidth / 2;
  }

  return (
    <div className="sequence-view" style={{ overflow: "auto" }}>
      <svg width={width} height={height}>
        {actors.map((actor) => (
          <g key={actor}>
            <text x={xFor(actor)} y={20} textAnchor="middle" className="sequence-actor-label">
              {actor}
            </text>
            <line x1={xFor(actor)} y1={30} x2={xFor(actor)} y2={height - 10} className="sequence-lifeline" />
          </g>
        ))}
        {ordered.map((span, idx) => {
          const y = 50 + idx * rowHeight;
          const parent = span.parentId ? ordered.find((s) => s.id === span.parentId) : undefined;
          const fromActor = parent ? actorFor(parent) : actorFor(span);
          const toActor = actorFor(span);
          const x1 = xFor(fromActor);
          const x2 = xFor(toActor);
          return (
            <g key={span.id}>
              {x1 !== x2 ? (
                <line x1={x1} y1={y} x2={x2} y2={y} className={`sequence-arrow status-${span.status}`} markerEnd="url(#seq-arrow)" />
              ) : (
                <circle cx={x2} cy={y} r={4} className={`sequence-self-call status-${span.status}`} />
              )}
              <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="sequence-call-label">
                {span.label}
              </text>
            </g>
          );
        })}
        <defs>
          <marker id="seq-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-secondary)" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
