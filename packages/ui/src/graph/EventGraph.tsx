// The live graph: turns the accumulated event log into a genuine flowing
// sequence (lanes advance step-by-step in the order things happened), not a
// star of everything radiating from one hub. Node labels come from
// narrate.ts (what actually happened), not just tool names. Rebuilt
// (memoized) whenever the event log changes. Rendered as a plain scrollable
// table of rows (indented by lane depth) rather than a draggable/pannable
// canvas — scrolling is the only navigation gesture needed here.
import { useMemo, useState } from "react";
import type { FlowbookEvent } from "../../../core/shared/events.js";
import { narrate, narrateShort } from "../../../core/shared/narrate.js";

type NodeKind = "root" | "agent" | "subagent" | "tool" | "skill" | "mcp" | "file" | "decision" | "validation" | "handoff";

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  count: number;
  lastEvidence: "observed" | "declared" | "inferred";
  events: FlowbookEvent[];
}

const KIND_META: Record<NodeKind, { border: string; bg: string; text: string; tag: string }> = {
  root: { border: "#1d1d1f", bg: "#ffffff", text: "#1d1d1f", tag: "session" },
  agent: { border: "#0071e3", bg: "#eaf3fe", text: "#0071e3", tag: "agent" },
  subagent: { border: "#8944ab", bg: "#f4ebfa", text: "#8944ab", tag: "subagent" },
  tool: { border: "#c76a00", bg: "#fdf1e2", text: "#c76a00", tag: "tool" },
  skill: { border: "#248a3d", bg: "#e6f6ea", text: "#248a3d", tag: "skill" },
  mcp: { border: "#0a7ea8", bg: "#e6f4f9", text: "#0a7ea8", tag: "mcp" },
  file: { border: "#5a5a5e", bg: "#f0f0f2", text: "#3a3a3c", tag: "file" },
  decision: { border: "#8944ab", bg: "#f9f2fc", text: "#6b3583", tag: "decision" },
  validation: { border: "#248a3d", bg: "#eef8f0", text: "#1c6b30", tag: "validation" },
  handoff: { border: "#8e8e93", bg: "#f2f2f4", text: "#48484a", tag: "handoff" },
};

// Which flowing "lane" an event belongs to: the main agent's own lane, or a
// specific subagent's own lane. Everything else (tools, mcp, hooks) is
// attributed to whichever lane is currently active for that actor.
function laneKey(event: FlowbookEvent): string {
  if (event.actor?.kind === "subagent") return `actor:subagent:${event.actor.id}`;
  return "main";
}

function toolFilePath(event: FlowbookEvent): string | undefined {
  const input = event.metadata?.input;
  if (!input || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  for (const key of ["filePath", "path", "query", "includePattern"]) {
    const v = rec[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function eventSignature(event: FlowbookEvent): string | null {
  switch (event.type) {
    case "tool.requested":
    case "tool.completed":
    case "tool.failed": {
      const tool = typeof event.metadata?.tool === "string" ? event.metadata.tool : "tool";
      const filePath = toolFilePath(event);
      // Phase is part of the signature so "about to look at X" (requested)
      // never collapses into the same node as "looked at X" (completed) --
      // each phase of a file lookup gets its own visible node in the flow.
      const phase = event.type.split(".")[1];
      return filePath ? `tool:${phase}:${tool}:${filePath}` : `tool:${phase}:${tool}`;
    }
    case "file.read":
    case "file.written":
    case "file.searched":
      return `file:${typeof event.metadata?.path === "string" ? event.metadata.path : "file"}`;
    case "mcp.tool.called":
      return `mcp:${typeof event.metadata?.tool === "string" ? event.metadata.tool : "mcp-tool"}`;
    case "mcp.resource.read":
      return `mcp:${typeof event.metadata?.uri === "string" ? event.metadata.uri : "resource"}`;
    case "skill.discovered":
    case "skill.accessed":
    case "skill.inferred":
      return `skill:${typeof event.metadata?.skill === "string" ? event.metadata.skill : "skill"}`;
    case "validation.started":
    case "validation.passed":
    case "validation.failed":
      return "validation:world";
    default:
      return null;
  }
}

function nodeKindFor(event: FlowbookEvent): NodeKind {
  switch (event.type) {
    case "tool.requested":
    case "tool.completed":
    case "tool.failed":
      return "tool";
    case "file.read":
    case "file.written":
    case "file.searched":
      return "file";
    case "mcp.tool.called":
    case "mcp.resource.read":
      return "mcp";
    case "skill.discovered":
    case "skill.accessed":
    case "skill.inferred":
      return "skill";
    case "validation.started":
    case "validation.passed":
    case "validation.failed":
      return "validation";
    default:
      return "tool";
  }
}

function nodeLabelFor(event: FlowbookEvent): string {
  switch (event.type) {
    case "tool.requested":
    case "tool.completed":
    case "tool.failed": {
      const tool = typeof event.metadata?.tool === "string" ? event.metadata.tool : "tool";
      const filePath = toolFilePath(event);
      if (filePath) return filePath.split(/[\\/]/).pop() ?? filePath;
      return tool;
    }
    case "file.read":
    case "file.written":
    case "file.searched": {
      const path = typeof event.metadata?.path === "string" ? event.metadata.path : "file";
      return path.split(/[\\/]/).pop() ?? path;
    }
    case "mcp.tool.called":
      return typeof event.metadata?.tool === "string" ? event.metadata.tool : "mcp-tool";
    case "mcp.resource.read":
      return typeof event.metadata?.uri === "string" ? event.metadata.uri : "resource";
    case "skill.discovered":
    case "skill.accessed":
    case "skill.inferred":
      return typeof event.metadata?.skill === "string" ? event.metadata.skill : "skill";
    case "validation.started":
    case "validation.passed":
    case "validation.failed":
      return event.type === "validation.failed" ? "Validation failed" : "World validator";
    default:
      return event.label;
  }
}

// Builds a genuine flow, not a hub-and-spoke star: each lane (the main
// agent, or a specific subagent) advances through a chain of steps in the
// order they happened, so edges show real sequential causality. A new
// subagent branches off the point in the main lane where it was spawned;
// consecutive identical actions (e.g. repeated reads of the same file)
// collapse into one node with a count, but different actions in sequence
// become separate, connected nodes.
function buildGraph(events: FlowbookEvent[]): {
  nodes: Map<string, GraphNode>;
  edges: Array<{ from: string; to: string; count: number }>;
} {
  const nodes = new Map<string, GraphNode>();
  const edgeCounts = new Map<string, number>();
  const edgeOrder: string[] = [];

  const rootId = "root:float";
  nodes.set(rootId, { id: rootId, label: "Float session", kind: "root", count: 1, lastEvidence: "observed", events: [] });

  function touchNode(id: string, label: string, kind: NodeKind, evidence: FlowbookEvent["evidence"], event: FlowbookEvent) {
    const existing = nodes.get(id);
    if (existing) {
      existing.count += 1;
      existing.lastEvidence = evidence;
      existing.events.push(event);
      existing.label = label;
    } else {
      nodes.set(id, { id, label, kind, count: 1, lastEvidence: evidence, events: [event] });
    }
  }

  function touchEdge(from: string, to: string) {
    const key = `${from}=>${to}`;
    if (!edgeCounts.has(key)) edgeOrder.push(key);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  const lanePointer = new Map<string, string>([["main", rootId]]);
  const laneLastSignature = new Map<string, string>();
  let seq = 0;

  for (const event of events) {
    const actorId = event.actor ? `actor:${event.actor.kind}:${event.actor.id}` : null;

    switch (event.type) {
      case "agent.started": {
        const id = actorId ?? "actor:agent:agent";
        touchNode(id, event.actor?.name ?? "agent", "agent", event.evidence, event);
        touchEdge(lanePointer.get("main")!, id);
        lanePointer.set("main", id);
        laneLastSignature.delete("main");
        break;
      }
      case "subagent.started": {
        const id = actorId ?? `actor:subagent:${event.id}`;
        const lane = `actor:subagent:${event.actor?.id ?? event.id}`;
        touchNode(id, event.actor?.name ?? "subagent", "subagent", event.evidence, event);
        touchEdge(lanePointer.get("main")!, id);
        lanePointer.set(lane, id);
        laneLastSignature.delete(lane);
        break;
      }
      case "subagent.stopped": {
        const id = actorId ?? `actor:subagent:${event.id}`;
        if (nodes.has(id)) touchNode(id, nodes.get(id)!.label, "subagent", event.evidence, event);
        break;
      }
      case "decision.declared": {
        const lane = laneKey(event);
        const id = `decision:${event.id}`;
        touchNode(id, event.label, "decision", event.evidence, event);
        touchEdge(lanePointer.get(lane) ?? lanePointer.get("main")!, id);
        lanePointer.set(lane, id);
        laneLastSignature.delete(lane);
        break;
      }
      case "agent.handoff": {
        // Becomes the new "main" anchor (like agent.started) so the
        // successor agent's own agent.started node connects from the
        // handoff node, not directly from whatever preceded the outgoing
        // agent -- the chain of custody stays visible in the graph.
        const lane = laneKey(event);
        const id = `handoff:${event.id}`;
        touchNode(id, event.label, "handoff", event.evidence, event);
        touchEdge(lanePointer.get(lane) ?? lanePointer.get("main")!, id);
        lanePointer.set("main", id);
        laneLastSignature.delete("main");
        break;
      }
      default: {
        const signature = eventSignature(event);
        if (!signature) break;
        const lane = laneKey(event);
        const from = lanePointer.get(lane) ?? lanePointer.get("main")!;

        if (laneLastSignature.get(lane) === signature) {
          // Same action repeated back-to-back in this lane: collapse into
          // the node already at the end of this lane instead of branching.
          const currentId = lanePointer.get(lane)!;
          touchNode(currentId, nodeLabelFor(event), nodeKindFor(event), event.evidence, event);
        } else {
          const id = `${nodeKindFor(event)}:${lane}:${signature}:${seq++}`;
          touchNode(id, nodeLabelFor(event), nodeKindFor(event), event.evidence, event);
          touchEdge(from, id);
          lanePointer.set(lane, id);
          laneLastSignature.set(lane, signature);
        }
        break;
      }
    }
  }

  const edges = edgeOrder.map((key) => {
    const [from, to] = key.split("=>") as [string, string];
    return { from, to, count: edgeCounts.get(key) ?? 1 };
  });

  return { nodes, edges };
}

const ROOT_ID = "root:float";

// Flattens the built graph into an ordered, indented row list (DFS over the
// same parent/child structure the old tree layout used), so the table reads
// top-to-bottom in causal/chronological order with nesting shown via indent
// rather than position.
interface GraphRow {
  node: GraphNode;
  depth: number;
}

function flattenGraph(nodes: Map<string, GraphNode>, edges: Array<{ from: string; to: string }>): GraphRow[] {
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const id of nodes.keys()) childrenOf.set(id, []);

  for (const { from, to } of edges) {
    if (hasParent.has(to)) continue; // keep the tree simple: first parent wins
    const parent = nodes.has(from) ? from : ROOT_ID;
    childrenOf.get(parent)?.push(to);
    hasParent.add(to);
  }

  const rows: GraphRow[] = [];
  function visit(id: string, depth: number) {
    const node = nodes.get(id);
    if (node && id !== ROOT_ID) rows.push({ node, depth });
    for (const child of childrenOf.get(id) ?? []) visit(child, node && id !== ROOT_ID ? depth + 1 : depth);
  }
  visit(ROOT_ID, 0);

  return rows;
}

export function EventGraph({
  events,
  onSelectEvent,
}: {
  events: FlowbookEvent[];
  onSelectEvent?: (event: FlowbookEvent) => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const { nodes, edges } = buildGraph(events);
    return flattenGraph(nodes, edges);
  }, [events]);

  if (rows.length === 0) {
    return <div className="inspector-empty">Nothing is thinking where we can see it.</div>;
  }

  return (
    <div className="event-table">
      {rows.map(({ node, depth }) => {
        const meta = KIND_META[node.kind];
        const latest = node.events.at(-1);
        return (
          <div
            key={node.id}
            className={`event-table-row${node.id === selectedNodeId ? " selected" : ""}`}
            style={{ paddingLeft: `${0.6 + depth * 1.1}rem` }}
            onClick={() => {
              setSelectedNodeId(node.id);
              if (latest && onSelectEvent) onSelectEvent(latest);
            }}
            title={latest ? narrate(latest) : node.label}
          >
            <span className="event-table-tag" style={{ color: meta.border, background: meta.bg }}>
              {meta.tag}
            </span>
            <span className="event-table-label">{node.label}</span>
            <span className="event-table-subtitle">{latest ? narrateShort(latest) : ""}</span>
            {node.count > 1 && <span className="event-table-count">{node.count}</span>}
            <span className={`badge badge-${node.lastEvidence}`}>{node.lastEvidence}</span>
          </div>
        );
      })}
    </div>
  );
}
