import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

export function AgentsPage(): JSX.Element {
  const { repoId } = useParams();
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', repoId],
    queryFn: () => api.listAgents(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading agents…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Agents</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents?.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-surface-raised p-4">
            <h3 className="font-medium text-text">{a.name}</h3>
            <p className="mono mt-1 text-xs text-text-muted">{a.path}</p>
            <p className="mt-2 text-xs text-text-muted">{a.body}</p>
            {a.tools && a.tools.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-text-muted">Tools</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-text"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {a.configuredSkills && a.configuredSkills.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-text-muted">
                  Configured skills
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.configuredSkills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {agents?.length === 0 && (
          <div className="text-text-muted">No agent definitions discovered.</div>
        )}
      </div>
    </div>
  );
}
