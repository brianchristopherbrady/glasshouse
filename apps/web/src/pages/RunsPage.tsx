import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Duration, formatRelativeTime } from '../components/Duration.js';

const STATUS_OPTIONS = ['all', 'success', 'failure', 'running', 'pending'] as const;

export function RunsPage(): JSX.Element {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [workflowId, setWorkflowId] = useState<string>('all');

  const { data: workflows } = useQuery({
    queryKey: ['workflows', repoId],
    queryFn: () => api.listWorkflows(repoId!),
    enabled: !!repoId,
  });

  const { data: runs, isLoading } = useQuery({
    queryKey: ['runs', repoId, status, workflowId],
    queryFn: () =>
      api.listRuns(repoId!, {
        status: status === 'all' ? undefined : status,
        workflowId: workflowId === 'all' ? undefined : workflowId,
      }),
    enabled: !!repoId,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">Runs</h1>
        <div className="flex gap-2">
          <select
            className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            aria-label="Filter by workflow"
          >
            <option value="all">All workflows</option>
            {workflows?.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text"
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div className="text-text-muted">Loading runs…</div>}

      {!isLoading && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Workflow</th>
                <th className="px-3 py-2 font-medium">Trigger</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Engine</th>
              </tr>
            </thead>
            <tbody>
              {runs?.map((run) => (
                <tr
                  key={run.id}
                  className="cursor-pointer border-t border-border hover:bg-surface-raised"
                  onClick={() => navigate(`/repos/${repoId}/runs/${run.id}`)}
                >
                  <td className="px-3 py-2">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-3 py-2 text-text">{run.workflowName}</td>
                  <td className="px-3 py-2 text-text-muted">{run.trigger}</td>
                  <td className="mono px-3 py-2 text-text-muted">{run.branch ?? '—'}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {formatRelativeTime(run.startTime)}
                  </td>
                  <td className="px-3 py-2">
                    <Duration ms={run.durationMs} />
                  </td>
                  <td className="px-3 py-2 text-text-muted">{run.engine ?? 'Unavailable'}</td>
                </tr>
              ))}
              {runs?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-text-muted">
                    No runs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
