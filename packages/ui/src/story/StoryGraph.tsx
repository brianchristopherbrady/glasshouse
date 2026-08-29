// The narrative tree: unlike the raw tool-call EventGraph, this view shows
// ONLY story beats -- decisions, agents/specialists taking up the case,
// validation outcomes, and milestones -- as a real branching tree (one
// decision can spawn several downstream beats, e.g. two specialists
// summoned to investigate different domains in parallel). Ordinary
// tool/file/skill/mcp activity is not drawn as its own node here; it's
// attributed to the beat that caused it and surfaces in the side panel
// (StoryPanel) instead, which is what keeps this diagram readable as the
// story rather than a full operational trace. Every field rendered comes
// straight from shared/story.ts's buildStoryGraph, which itself only reads
// real event fields -- nothing here is invented narration.
import { useMemo, useState } from "react";
import { ReactFlow, Background, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutStoryGraph, type StoryBeat, type StoryBeatKind, type StoryGraph as StoryGraphModel } from "../../../core/shared/story.js";

const KIND_META: Record<StoryBeatKind, { border: string; bg: string; text: string; tag: string }> = {
  root: { border: "#1d1d1f", bg: "#ffffff", text: "#1d1d1f", tag: "session" },
  agent: { border: "#0071e3", bg: "#eaf3fe", text: "#0071e3", tag: "agent" },
  subagent: { border: "#8944ab", bg: "#f4ebfa", text: "#8944ab", tag: "specialist" },
  decision: { border: "#c76a00", bg: "#fdf1e2", text: "#c76a00", tag: "decision" },
  validation: { border: "#248a3d", bg: "#eef8f0", text: "#1c6b30", tag: "validation" },
  milestone: { border: "#0a7ea8", bg: "#e6f4f9", text: "#0a7ea8", tag: "milestone" },
  handoff: { border: "#8e8e93", bg: "#f2f2f4", text: "#48484a", tag: "handoff" },
};

const FAILURE_META = { border: "#d70015", bg: "#fce9ea", text: "#d70015" };

interface StoryNodeData {
  [key: string]: unknown;
  beat: StoryBeat;
}

function toneFor(beat: StoryBeat) {
  const failed = beat.kind === "validation" && beat.sourceEvent?.type === "validation.failed";
  if (failed || beat.unresolved) return FAILURE_META;
  return KIND_META[beat.kind];
}

function StoryNode({ data, selected }: NodeProps & { data: StoryNodeData }) {
  const { beat } = data;
  const tone = toneFor(beat);
  const tag = KIND_META[beat.kind].tag;
  return (
    <div
      className={`story-node${selected ? " story-node-selected" : ""}${beat.unresolved ? " story-node-unresolved" : ""}`}
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
      title={beat.title}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div className="story-node-top">
        <span className="story-node-tag" style={{ color: tone.border }}>
          {tag}
        </span>
        {beat.unresolved && <span className="story-node-unresolved-dot" title="Unresolved thread" />}
      </div>
      {beat.character && <span className="story-node-character">{beat.character}</span>}
      <span className="story-node-title">{beat.title}</span>
      {beat.effects.length > 0 && <span className="story-node-count">{beat.effects.length}</span>}
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </div>
  );
}

const NODE_TYPES = { storyBeat: StoryNode };
const NODE_W = 240;
const NODE_H = 50;

export function StoryGraph({
  graph,
  onSelectBeat,
}: {
  graph: StoryGraphModel;
  onSelectBeat?: (beat: StoryBeat | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { flowNodes, flowEdges } = useMemo(() => {
    const positions = layoutStoryGraph(graph, { nodeWidth: NODE_W });

    const flowNodes: Node[] = [...graph.beats.values()].map((beat) => ({
      id: beat.id,
      type: "storyBeat",
      position: positions.get(beat.id) ?? { x: 0, y: 0 },
      data: { beat },
      width: NODE_W,
      height: NODE_H,
    }));

    const flowEdges: Edge[] = [...graph.beats.values()]
      .filter((beat) => beat.parentId)
      .map((beat) => ({
        id: `${beat.parentId}=>${beat.id}`,
        source: beat.parentId as string,
        target: beat.id,
        style: { stroke: beat.unresolved ? "#d70015" : "#d2d2d7", strokeWidth: beat.unresolved ? 2 : 1.5 },
      }));

    return { flowNodes, flowEdges };
  }, [graph]);

  if (flowNodes.length <= 1) {
    return <div className="inspector-empty">No story yet -- nothing has happened.</div>;
  }

  return (
    <ReactFlow
      nodes={flowNodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.3, maxZoom: 1.15 }}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => {
        setSelectedId(node.id);
        onSelectBeat?.(graph.beats.get(node.id) ?? null);
      }}
      onPaneClick={() => {
        setSelectedId(null);
        onSelectBeat?.(null);
      }}
    >
      <Background color="#e5e5ea" gap={24} />
    </ReactFlow>
  );
}
