// Real ELK-based hierarchical layout for the Blueprint/Run graph, per
// docs/flowbook-vision.md's "ELK-style hierarchical layout" recommendation
// -- an actual layout engine computing real positions from the real
// resource/relationship graph, not a hand-rolled approximation.
import ELK from "elkjs/lib/elk.bundled.js";
import type { Relationship, Resource } from "../../../core/shared/flowbook-types.js";

const elk = new ELK();

const NODE_WIDTH = 220;
const NODE_HEIGHT = 64;

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function layoutBlueprint(
  resources: Resource[],
  relationships: Relationship[],
): Promise<Map<string, LaidOutNode>> {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "56",
      "elk.spacing.nodeNode": "32",
    },
    children: resources.map((r) => ({ id: r.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: relationships.map((rel, i) => ({ id: `e${i}`, sources: [rel.from], targets: [rel.to] })),
  };

  const result = await elk.layout(graph);
  const positions = new Map<string, LaidOutNode>();
  for (const child of result.children ?? []) {
    positions.set(child.id!, {
      id: child.id!,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? NODE_WIDTH,
      height: child.height ?? NODE_HEIGHT,
    });
  }
  return positions;
}
