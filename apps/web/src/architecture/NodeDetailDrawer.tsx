import clsx from 'clsx';
import { KIND_META, RELATIONSHIP_LABELS } from './kindMeta.js';
import { EvidenceTag } from '../components/EvidenceTag.js';
import type { ArchitectureEdge, ArchitectureNode } from '../api/types.js';

export function NodeDetailDrawer({
  node,
  edges,
  nodesById,
  onClose,
}: {
  node: ArchitectureNode;
  edges: ArchitectureEdge[];
  nodesById: Map<string, ArchitectureNode>;
  onClose: () => void;
}): JSX.Element {
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);

  return (
    <div className="absolute right-0 top-0 flex h-full w-80 flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div className={clsx('flex items-center gap-1.5 text-xs', meta.colorClass)}>
          <Icon size={13} />
          {meta.label}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text">{node.name}</h3>
        <p className="mono mt-1 text-xs text-text-muted">{node.path}</p>
      </div>

      {outgoing.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-text-muted">
            Relates to ({outgoing.length})
          </div>
          <div className="flex flex-col gap-2">
            {outgoing.map((e) => {
              const target = nodesById.get(e.target);
              return (
                <div key={e.id} className="rounded border border-border bg-surface-raised p-2 text-xs">
                  <div className="text-text">
                    {RELATIONSHIP_LABELS[e.relationshipType] ?? e.relationshipType}{' '}
                    <span className="font-medium">{target?.name ?? e.target}</span>
                  </div>
                  <div className="mt-1">
                    <EvidenceTag source={e.evidenceSource} confidence={e.evidenceConfidence} />
                  </div>
                  {e.evidenceNote && <div className="mt-1 text-text-muted">{e.evidenceNote}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-text-muted">
            Referenced by ({incoming.length})
          </div>
          <div className="flex flex-col gap-2">
            {incoming.map((e) => {
              const source = nodesById.get(e.source);
              return (
                <div key={e.id} className="rounded border border-border bg-surface-raised p-2 text-xs">
                  <div className="text-text">
                    <span className="font-medium">{source?.name ?? e.source}</span>{' '}
                    {RELATIONSHIP_LABELS[e.relationshipType] ?? e.relationshipType} this
                  </div>
                  <div className="mt-1">
                    <EvidenceTag source={e.evidenceSource} confidence={e.evidenceConfidence} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outgoing.length === 0 && incoming.length === 0 && (
        <div className="text-xs text-text-muted">
          No discovered relationships involve this definition.
        </div>
      )}
    </div>
  );
}
