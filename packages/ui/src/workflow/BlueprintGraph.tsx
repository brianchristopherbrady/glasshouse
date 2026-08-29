// Renders a workflow's Blueprint (design-time resources/relationships) as
// a real ELK-laid-out node graph, optionally overlaid with a live Run's
// span status per resource (Run mode: idle/running/success/failure ring).
// Kept as plain positioned divs (not @xyflow/react) -- this graph has no
// need for drag/drop/pan-zoom-canvas editing (per docs/flowbook-vision.md,
// "code remains the source of truth" for v0.1), just a real computed
// layout rendered statically with click-to-inspect.
import { useEffect, useMemo, useState } from "react";
import type { Relationship, Resource, Run, SpanStatus } from "../../../core/shared/flowbook-types.js";
import { layoutBlueprint, type LaidOutNode } from "./elkLayout.js";
import { KIND_META } from "./resourceIcons.js";

/** Resolves the most relevant Span for a resource in the current Run --
 * "running" wins over any terminal state, the latest terminal span wins
 * over an earlier one, so a repair-loop's second attempt is what's shown. */
function statusForResource(run: Run | null, resourceId: string): SpanStatus | undefined {
  if (!run) return undefined;
  const spans = run.spans.filter((s) => s.resourceId === resourceId);
  if (spans.length === 0) return undefined;
  const running = spans.find((s) => s.status === "running");
  if (running) return "running";
  return spans.at(-1)?.status;
}

const STATUS_RING: Record<SpanStatus, string> = {
  running: "var(--blue)",
  success: "var(--green)",
  failure: "var(--red)",
};

export function BlueprintGraph({
  resources,
  relationships,
  run,
  selectedId,
  onSelect,
}: {
  resources: Resource[];
  relationships: Relationship[];
  run: Run | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [positions, setPositions] = useState<Map<string, LaidOutNode> | null>(null);

  const resourceKey = useMemo(() => resources.map((r) => r.id).join(","), [resources]);
  const relationshipKey = useMemo(() => relationships.map((r) => `${r.from}>${r.to}`).join(","), [relationships]);

  useEffect(() => {
    let cancelled = false;
    layoutBlueprint(resources, relationships).then((result) => {
      if (!cancelled) setPositions(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey, relationshipKey]);

  if (!positions) {
    return <div className="inspector-empty">Laying out graph…</div>;
  }

  const width = Math.max(...[...positions.values()].map((p) => p.x + p.width), 400) + 40;
  const height = Math.max(...[...positions.values()].map((p) => p.y + p.height), 300) + 40;

  return (
    <div className="blueprint-canvas" style={{ position: "relative", width, height }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {relationships.map((rel, i) => {
          const from = positions.get(rel.from);
          const to = positions.get(rel.to);
          if (!from || !to) return null;
          const x1 = from.x + from.width / 2;
          const y1 = from.y + from.height;
          const x2 = to.x + to.width / 2;
          const y2 = to.y;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth={1.5} markerEnd="url(#arrow)" />
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--border)" />
          </marker>
        </defs>
      </svg>
      {resources.map((resource) => {
        const pos = positions.get(resource.id);
        if (!pos) return null;
        const meta = KIND_META[resource.kind];
        const status = statusForResource(run, resource.id);
        return (
          <div
            key={resource.id}
            className={`blueprint-node${resource.id === selectedId ? " selected" : ""}`}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.width,
              height: pos.height,
              borderColor: status ? STATUS_RING[status] : undefined,
            }}
            onClick={() => onSelect(resource.id)}
          >
            <div className="blueprint-node-header">
              <span style={{ color: meta.color }}>{meta.icon}</span>
              <span className="blueprint-node-kind">{resource.kind}</span>
              {status && <span className={`blueprint-node-status status-${status}`}>{status}</span>}
            </div>
            <div className="blueprint-node-label">{resource.label}</div>
          </div>
        );
      })}
    </div>
  );
}
