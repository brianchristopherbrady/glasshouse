import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '../api/client.js';

export function SkillsPage(): JSX.Element {
  const { repoId } = useParams();
  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills', repoId],
    queryFn: () => api.listSkills(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading skills…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Skills</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skills?.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-border bg-surface-raised p-4 shadow-raised"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-evidence-strong-wash text-evidence-strong">
                <Sparkles size={13} strokeWidth={2.25} />
              </span>
              <h3 className="font-medium text-text">{s.name}</h3>
            </div>
            <p className="mono mt-2 text-xs text-text-muted">{s.path}</p>
            {s.description && (
              <p className="mt-2 line-clamp-3 text-xs text-text-muted">{s.description}</p>
            )}
          </div>
        ))}
        {skills?.length === 0 && (
          <div className="text-text-muted">No skill definitions discovered.</div>
        )}
      </div>
    </div>
  );
}
