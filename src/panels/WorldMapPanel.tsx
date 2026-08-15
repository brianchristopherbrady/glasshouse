// The world, visualized as a relationship web — not the event-flow graph.
// Every structure, institution, and relationship shown here is read live
// from world/*.json on disk, so this view persists across page loads and
// reflects the true current state of the world the agents are editing, not
// client-side/session state. Nodes are structures/institutions; edges are
// relationships, colored by status (active/corrected/severed/redirected/
// constrained/unresolved).
import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchWorld, type WorldResponse } from "../api/client.js";
import type { Structure, Institution, RelationshipStatus } from "../../shared/world-types.js";

const STATUS_META: Record<RelationshipStatus, { stroke: string; dash?: string }> = {
  active: { stroke: "#248a3d" },
  corrected: { stroke: "#c76a00", dash: "4 4" },
  severed: { stroke: "#d70015", dash: "2 3" },
  redirected: { stroke: "#0071e3", dash: "6 3" },
  constrained: { stroke: "#8944ab", dash: "1 3" },
  unresolved: { stroke: "#a1a1a6", dash: "3 3" },
};

const NODE_W = 190;
const NODE_H = 66;
const GAP = 60;

interface EntityNodeData {
  name: string;
  kind: "structure" | "institution";
  subtitle?: string;
  openProvenance?: boolean;
  [key: string]: unknown;
}

function EntityNode({ data }: NodeProps & { data: EntityNodeData }) {
  const isInstitution = data.kind === "institution";
  const border = data.openProvenance ? "#d70015" : isInstitution ? "#0a7ea8" : "#8944ab";
  const bg = data.openProvenance ? "#fce9ea" : isInstitution ? "#e6f4f9" : "#f4ebfa";
  const text = data.openProvenance ? "#d70015" : isInstitution ? "#0a7ea8" : "#8944ab";
  return (
    <div className="world-node" style={{ background: bg, borderColor: border, color: text }}>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
      <span className="world-node-type" style={{ color: border }}>
        {data.kind}
        {data.openProvenance ? " · open provenance" : ""}
      </span>
      <span className="world-node-label">{data.name}</span>
      {data.subtitle && (
        <span className="world-node-tags">
          <span className="world-node-tag-pill">{data.subtitle}</span>
        </span>
      )}
    </div>
  );
}

const NODE_TYPES = { entity: EntityNode };

export function WorldMapPanel() {
  const [data, setData] = useState<WorldResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Structure | Institution | null>(null);

  useEffect(() => {
    fetchWorld()
      .then(setData)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="inspector-empty">World data could not be read: {error}</div>;
  }
  if (!data) {
    return <div className="inspector-empty">Reading the world…</div>;
  }

  const { world, validation } = data;
  const entityIds = [
    ...world.structures.structures.map((c) => c.id),
    ...world.institutions.institutions.map((i) => i.id),
  ];

  // No natural spatial coordinates in this world (relationships aren't
  // geography). Lay entities out in a simple row, spaced by width, and let
  // fitView handle overall framing — legible for the small hand-authored
  // cast this world currently has.
  const positions = new Map<string, { x: number; y: number }>();
  entityIds.forEach((id, i) => {
    positions.set(id, { x: i * (NODE_W + GAP), y: 0 });
  });

  const flowNodes: Node[] = [
    ...world.structures.structures.map((c) => ({
      id: c.id,
      type: "entity",
      position: positions.get(c.id)!,
      data: {
        name: c.name,
        kind: "structure" as const,
        subtitle: c.role,
        openProvenance: c.provenanceStatus === "open",
      },
      width: NODE_W,
      height: NODE_H,
    })),
    ...world.institutions.institutions.map((i) => ({
      id: i.id,
      type: "entity",
      position: positions.get(i.id)!,
      data: { name: i.name, kind: "institution" as const, subtitle: i.domain },
      width: NODE_W,
      height: NODE_H,
    })),
  ];

  const flowEdges: Edge[] = world.relationships.relationships.map((rel) => {
    const meta = STATUS_META[rel.status];
    return {
      id: rel.id,
      source: rel.subject,
      target: rel.object,
      label: rel.kind,
      style: { stroke: meta.stroke, strokeWidth: 2, strokeDasharray: meta.dash },
      labelStyle: { fontSize: 10, fill: meta.stroke },
      labelBgStyle: { fill: "#ffffff" },
    };
  });

  const findEntity = (id: string): Structure | Institution | undefined =>
    world.structures.structures.find((c) => c.id === id) ?? world.institutions.institutions.find((i) => i.id === id);

  return (
    <div className="world-map-layout">
      <div className="world-map-canvas">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.4 }}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => setSelected(findEntity(node.id) ?? null)}
          onPaneClick={() => setSelected(null)}
        >
          <Background color="#e5e5ea" gap={24} />
        </ReactFlow>
      </div>

      <div className="panel world-map-side">
        <p className="panel-title">World Map</p>
        <div className={`world-validity ${validation.valid ? "world-valid" : "world-invalid"}`}>
          {validation.valid
            ? "The world is structurally consistent."
            : `${validation.issues.length} validator issue${validation.issues.length === 1 ? "" : "s"} found`}
        </div>
        {!validation.valid && (
          <ul className="world-issue-list">
            {validation.issues.map((issue, i) => (
              <li key={i}>
                <strong>{issue.rule}</strong> ({issue.severity}) — {issue.subject}: {issue.message}
              </li>
            ))}
          </ul>
        )}

        <p className="panel-title" style={{ marginTop: "1rem" }}>
          Structures ({world.structures.structures.length})
        </p>
        <ul className="activity-list">
          {world.structures.structures.map((c) => (
            <li key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
              <span>{c.name}</span>
              <span>{c.provenanceStatus}</span>
            </li>
          ))}
        </ul>

        <p className="panel-title" style={{ marginTop: "1rem" }}>
          Institutions ({world.institutions.institutions.length})
        </p>
        <ul className="activity-list">
          {world.institutions.institutions.map((i) => (
            <li key={i.id} style={{ cursor: "pointer" }} onClick={() => setSelected(i)}>
              <span>{i.name}</span>
              <span>{i.domain ?? ""}</span>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="world-selected-detail">
            <p className="panel-title">{selected.name}</p>
            <div className="inspector-field">
              <span className="inspector-label">{"provenanceStatus" in selected ? "Provenance" : "Domain"}</span>
              <span className="inspector-value">
                {"provenanceStatus" in selected ? selected.provenanceStatus : (selected as Institution).domain ?? "—"}
              </span>
            </div>
            {selected.notes && (
              <div className="inspector-field">
                <span className="inspector-label">Notes</span>
                <span className="inspector-value">{selected.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
