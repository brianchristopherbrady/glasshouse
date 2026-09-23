import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

export function FilesPage(): JSX.Element {
  const { repoId } = useParams();
  const { data: hotspots, isLoading } = useQuery({
    queryKey: ['file-hotspots', repoId],
    queryFn: () => api.listFileHotspots(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading file activity…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Files</h1>
      <p className="text-xs text-text-muted">
        Aggregated agent activity across runs — what code do autonomous workflows keep changing?
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 font-medium">Runs touching</th>
              <th className="px-3 py-2 font-medium">Workflows</th>
              <th className="px-3 py-2 font-medium">Total ops</th>
              <th className="px-3 py-2 font-medium">Failure correlation</th>
            </tr>
          </thead>
          <tbody>
            {hotspots?.map((h) => (
              <tr key={h.path} className="border-t border-border">
                <td className="mono px-3 py-2 text-text">{h.path}</td>
                <td className="px-3 py-2 text-text">{h.runCount}</td>
                <td className="px-3 py-2 text-text-muted">{h.workflows.join(', ')}</td>
                <td className="px-3 py-2 text-text">{h.totalOps}</td>
                <td className="px-3 py-2 text-text">
                  {h.failureCount > 0 ? (
                    <span className="text-status-failure">{h.failureCount} failing run(s)</span>
                  ) : (
                    <span className="text-text-muted">None observed</span>
                  )}
                </td>
              </tr>
            ))}
            {hotspots?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                  No file activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
