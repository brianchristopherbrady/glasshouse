import { describe, expect, it } from 'vitest';
import { buildSpanTree } from '../src/trace.js';

function makeSpan(overrides: Partial<Parameters<typeof buildSpanTree>[0][number]>) {
  return {
    id: 'span',
    runId: 'run_1',
    parentSpanId: null,
    type: 'custom',
    name: 'span',
    actorId: null,
    startTime: new Date('2026-01-01T00:00:00.000Z'),
    endTime: new Date('2026-01-01T00:00:01.000Z'),
    durationMs: 1000,
    status: 'success',
    attributes: '{}',
    source: 'runtime',
    confidence: 'observed',
    ...overrides,
  } as Parameters<typeof buildSpanTree>[0][number];
}

describe('buildSpanTree', () => {
  it('nests children under their real parentSpanId', () => {
    const root = makeSpan({ id: 'root', parentSpanId: null, name: 'workflow' });
    const child = makeSpan({ id: 'child', parentSpanId: 'root', name: 'agent' });
    const grandchild = makeSpan({ id: 'grandchild', parentSpanId: 'child', name: 'tool' });

    const tree = buildSpanTree([root, child, grandchild]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('root');
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.id).toBe('child');
    expect(tree[0]?.children[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('grandchild');
  });

  it('treats a span whose parent is not in the list as a root', () => {
    const orphan = makeSpan({ id: 'orphan', parentSpanId: 'does-not-exist' });
    const tree = buildSpanTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('orphan');
  });

  it('sorts siblings by start time', () => {
    const first = makeSpan({
      id: 'first',
      startTime: new Date('2026-01-01T00:00:00.000Z'),
    });
    const second = makeSpan({
      id: 'second',
      startTime: new Date('2026-01-01T00:00:05.000Z'),
    });
    const tree = buildSpanTree([second, first]);
    expect(tree.map((s) => s.id)).toEqual(['first', 'second']);
  });

  it('parses the JSON-serialized attributes column back into an object', () => {
    const span = makeSpan({ attributes: '{"foo":"bar"}' });
    const tree = buildSpanTree([span]);
    expect(tree[0]?.attributes).toEqual({ foo: 'bar' });
  });
});
