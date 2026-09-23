import type { Span as PrismaSpan } from '@prisma/client';

function parseJsonColumn(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export interface TraceSpanNode {
  id: string;
  parentSpanId: string | null;
  type: string;
  name: string;
  actorId: string | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  status: string;
  attributes: unknown;
  source: string;
  confidence: string;
  children: TraceSpanNode[];
}

/** Builds a span forest (usually one root: the workflow span) from a flat list. */
export function buildSpanTree(spans: PrismaSpan[]): TraceSpanNode[] {
  const nodeById = new Map<string, TraceSpanNode>();
  for (const span of spans) {
    nodeById.set(span.id, {
      id: span.id,
      parentSpanId: span.parentSpanId,
      type: span.type,
      name: span.name,
      actorId: span.actorId,
      startTime: span.startTime.toISOString(),
      endTime: span.endTime ? span.endTime.toISOString() : null,
      durationMs: span.durationMs,
      status: span.status,
      attributes: parseJsonColumn(span.attributes),
      source: span.source,
      confidence: span.confidence,
      children: [],
    });
  }

  const roots: TraceSpanNode[] = [];
  for (const span of spans) {
    const node = nodeById.get(span.id);
    if (!node) continue;
    if (span.parentSpanId && nodeById.has(span.parentSpanId)) {
      nodeById.get(span.parentSpanId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByStart = (nodes: TraceSpanNode[]) => {
    nodes.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const n of nodes) sortByStart(n.children);
  };
  sortByStart(roots);

  return roots;
}
