import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { SyncPanel } from '../components/SyncPanel.js';

export function FlowsPage(): JSX.Element {
  const { repoId } = useParams();
  const queryClient = useQueryClient();
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', repoId],
    queryFn: () => api.listWorkflows(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading workflows…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Flows</h1>
        <SyncPanel
          repoId={repoId!}
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['workflows', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['relationships', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['agents', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['skills', repoId] });
          }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflows?.map((wf) => (
          <div
            key={wf.id}
            className="flex flex-col rounded-lg border border-border bg-surface-raised p-4 shadow-raised"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-text">{wf.name}</h3>
              {wf.engine && (
                <span className="mono shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-text-muted">
                  {wf.engine}
                </span>
              )}
            </div>
            <p className="mono mt-1 text-xs text-text-muted">{wf.path}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {wf.triggers.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-accent-wash px-2 py-0.5 text-xs font-medium text-accent"
                >
                  {t}
                </span>
              ))}
            </div>
            {wf.safeOutputs && wf.safeOutputs.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Safe outputs
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {wf.safeOutputs.map((o) => (
                    <span
                      key={o}
                      className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {wf.permissions && (
              <div className="mt-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Permissions
                </div>
                <div className="mono mt-1 text-xs text-text">
                  {Object.entries(wf.permissions)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')}
                </div>
              </div>
            )}
            <div className="mt-auto pt-3 text-xs text-text-muted">
              {wf.compiledWorkflow ? `Compiled: ${wf.compiledWorkflow.path}` : 'Not compiled'}
            </div>
          </div>
        ))}
        {workflows?.length === 0 && (
          <div className="text-text-muted">No workflows discovered in this repository.</div>
        )}
      </div>
    </div>
  );
}
