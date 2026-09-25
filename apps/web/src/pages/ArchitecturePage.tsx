import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ArchitectureGraph } from '../architecture/ArchitectureGraph.js';
import { KIND_META, KIND_ORDER } from '../architecture/kindMeta.js';

export function ArchitecturePage(): JSX.Element {
  const { repoId } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['architecture', repoId],
    queryFn: () => api.getArchitecture(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading architecture graph…</div>;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-status-failure/40 bg-status-failure-wash p-4 text-status-failure">
        Failed to load the architecture graph.
      </div>
    );
  }

  const kindCounts = new Map<string, number>();
  for (const n of data.nodes) kindCounts.set(n.kind, (kindCounts.get(n.kind) ?? 0) + 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Architecture</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {KIND_ORDER.filter((k) => (kindCounts.get(k) ?? 0) > 0).map((k) => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            return (
              <span
                key={k}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
              >
                <Icon size={12} />
                {meta.label} ({kindCounts.get(k)})
              </span>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Static relationships discovered from the repository's own files — click a node for
        details, including the evidence behind each connection. Scroll or trackpad-pinch to
        zoom, drag the canvas to pan.
      </p>
      <ArchitectureGraph nodes={data.nodes} edges={data.edges} />
    </div>
  );
}
