import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { layoutArchitectureGraph } from './layout.js';
import { ArchitectureNodeView } from './ArchitectureNode.js';
import { NodeDetailDrawer } from './NodeDetailDrawer.js';
import type { ArchitectureEdge, ArchitectureNode } from '../api/types.js';

const nodeTypes = { architecture: ArchitectureNodeView };

export function ArchitectureGraph({
  nodes,
  edges,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const { flowNodes, flowEdges } = useMemo(() => {
    const laidOut = layoutArchitectureGraph(nodes, edges);
    const rfNodes: Node[] = laidOut.map((l) => ({
      id: l.id,
      type: 'architecture',
      position: { x: l.x, y: l.y },
      data: l.node as unknown as Record<string, unknown>,
      draggable: false,
    }));
    const rfEdges: Edge[] = edges
      .filter((e) => nodesById.has(e.source) && nodesById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.relationshipType.toLowerCase().replace(/_/g, ' '),
        style: { stroke: 'var(--border)' },
        labelStyle: { fill: 'var(--text-muted)', fontSize: 10 },
        animated: false,
      }));
    return { flowNodes: rfNodes, flowEdges: rfEdges };
  }, [nodes, edges, nodesById]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-text-muted">
        No definitions discovered yet — run a sync from the Flows page first.
      </div>
    );
  }

  const selectedNode = selectedId ? nodesById.get(selectedId) : null;

  return (
    <div className="relative min-h-[420px] flex-1 rounded-lg border border-border bg-surface-sunken">
      <div className="absolute inset-0">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor="var(--surface-raised)"
            maskColor="rgba(13,17,23,0.6)"
          />
        </ReactFlow>
      </div>
      {selectedNode && (
        <NodeDetailDrawer
          node={selectedNode}
          edges={edges}
          nodesById={nodesById}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
