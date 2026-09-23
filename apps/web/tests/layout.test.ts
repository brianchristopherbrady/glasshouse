import { describe, expect, it } from 'vitest';
import { layoutArchitectureGraph } from '../src/architecture/layout.js';
import type { ArchitectureEdge, ArchitectureNode } from '../src/api/types.js';

function node(id: string, kind: ArchitectureNode['kind'] = 'agent'): ArchitectureNode {
  return { id, kind, name: id, path: `${id}.md` };
}

function edge(source: string, target: string): ArchitectureEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    sourceKind: 'agent',
    targetKind: 'skill',
    relationshipType: 'CONFIGURES',
    evidenceSource: 'parser',
    evidenceConfidence: 'strong',
    evidenceNote: null,
  };
}

describe('layoutArchitectureGraph', () => {
  it('places a root node (no incoming edges) at depth 0', () => {
    const layout = layoutArchitectureGraph([node('a'), node('b')], [edge('a', 'b')]);
    const a = layout.find((l) => l.id === 'a');
    const b = layout.find((l) => l.id === 'b');
    expect(a?.x).toBe(0);
    expect(b?.x).toBeGreaterThan(a!.x);
  });

  it('places a node at the longest-path depth when reachable via multiple paths', () => {
    // root -> mid -> leaf, and root -> leaf directly. leaf's depth should
    // reflect the LONGEST path (via mid), not the shortest direct edge.
    const layout = layoutArchitectureGraph(
      [node('root'), node('mid'), node('leaf')],
      [edge('root', 'mid'), edge('mid', 'leaf'), edge('root', 'leaf')],
    );
    const root = layout.find((l) => l.id === 'root')!;
    const mid = layout.find((l) => l.id === 'mid')!;
    const leaf = layout.find((l) => l.id === 'leaf')!;
    expect(leaf.x).toBeGreaterThan(mid.x);
    expect(mid.x).toBeGreaterThan(root.x);
  });

  it('never assigns overlapping (x,y) positions within the same layer', () => {
    const layout = layoutArchitectureGraph(
      [node('root'), node('a'), node('b'), node('c')],
      [edge('root', 'a'), edge('root', 'b'), edge('root', 'c')],
    );
    const sameLayer = layout.filter((l) => l.id !== 'root');
    const ys = sameLayer.map((l) => l.y);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('handles a node with no edges at all (isolated node)', () => {
    const layout = layoutArchitectureGraph([node('lonely')], []);
    expect(layout).toHaveLength(1);
    expect(layout[0]?.x).toBe(0);
  });

  it('does not infinite-loop on a relationship cycle', () => {
    const layout = layoutArchitectureGraph(
      [node('a'), node('b')],
      [edge('a', 'b'), edge('b', 'a')],
    );
    expect(layout).toHaveLength(2);
  });

  it('ignores an edge referencing a node that is not in the node list', () => {
    const layout = layoutArchitectureGraph([node('a')], [edge('a', 'does-not-exist')]);
    expect(layout).toHaveLength(1);
  });
});
