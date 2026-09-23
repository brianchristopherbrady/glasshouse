import type { ArchitectureEdge, ArchitectureNode } from '../api/types.js';

export interface LayoutNode {
  id: string;
  node: ArchitectureNode;
  x: number;
  y: number;
}

const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 90;

/**
 * Assigns each node a layer (column) based on longest-path depth from any
 * root (a node with no incoming edge), then stacks nodes within a layer
 * vertically. Deterministic and cheap — appropriate for the tens-of-nodes
 * graphs this product deals with, not a physics/force simulation.
 */
export function layoutArchitectureGraph(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
): LayoutNode[] {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    if (!incoming.has(e.target) || !outgoing.has(e.source)) continue; // dangling edge, ignore
    incoming.get(e.target)!.push(e.source);
    outgoing.get(e.source)!.push(e.target);
  }

  const depthById = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(id: string): number {
    const cached = depthById.get(id);
    if (cached !== undefined) return cached;
    const parents = incoming.get(id) ?? [];
    if (parents.length === 0) {
      depthById.set(id, 0);
      return 0;
    }
    if (visiting.has(id)) {
      // Cycle guard: never loop forever on a (should-be-impossible, but
      // defensively handled) relationship cycle.
      depthById.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const depth = 1 + Math.max(...parents.map((p) => depthOf(p)));
    visiting.delete(id);
    depthById.set(id, depth);
    return depth;
  }

  for (const n of nodes) depthOf(n.id);

  const nodesByDepth = new Map<number, ArchitectureNode[]>();
  for (const n of nodes) {
    const d = depthById.get(n.id) ?? 0;
    const list = nodesByDepth.get(d) ?? [];
    list.push(n);
    nodesByDepth.set(d, list);
  }

  const layoutNodes: LayoutNode[] = [];
  for (const [depth, group] of nodesByDepth) {
    const sorted = [...group].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    sorted.forEach((node, i) => {
      layoutNodes.push({
        id: node.id,
        node,
        x: depth * COLUMN_WIDTH,
        y: i * ROW_HEIGHT,
      });
    });
  }

  return layoutNodes;
}
