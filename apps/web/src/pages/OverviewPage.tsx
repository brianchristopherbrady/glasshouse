import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { Metric } from '../components/Metric.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Duration, formatDuration, formatRelativeTime } from '../components/Duration.js';

function pct(value: number | null): string {
  if (value == null) return 'Unavailable';
  return `${Math.round(value * 100)}%`;
}

export function OverviewPage(): JSX.Element {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['overview', repoId],
    queryFn: () => api.getOverview(repoId!),
    enabled: !!repoId,
  });

  if (isLoading) return <div className="text-text-muted">Loading overview…</div>;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-status-failure/40 bg-surface-raised p-4 text-status-failure">
        Failed to load repository overview.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Total runs" value={data.totalRuns} />
        <Metric label="Success rate" value={pct(data.successRate)} />
        <Metric label="Avg duration" value={formatDuration(data.averageDurationMs)} />
        <Metric label="Handoffs" value={data.handoffCount} />
        <Metric label="Workflows" value={data.workflowDefCount} />
        <Metric label="Agents configured" value={data.agentDefCount} />
        <Metric label="Skills configured" value={data.skillDefCount} />
        <Metric label="Tool calls" value={data.toolCallCount} />
        <Metric label="Files changed" value={data.fileOpCount} />
        <Metric label="Pull requests" value={data.pullRequestCount} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">Recent runs</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Workflow</th>
                <th className="px-3 py-2 font-medium">Trigger</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map((run) => (
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
                  <td className="px-3 py-2 text-text-muted">
                    {formatRelativeTime(run.startTime)}
                  </td>
                  <td className="px-3 py-2">
                    <Duration ms={run.durationMs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.failingRuns.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-text">Recent failures</h2>
          <div className="overflow-hidden rounded-lg border border-status-failure/30">
            <table className="w-full text-left text-sm">
              <tbody>
                {data.failingRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer border-t border-border hover:bg-surface-raised"
                    onClick={() => navigate(`/repos/${repoId}/runs/${run.id}`)}
                  >
                    <td className="px-3 py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-3 py-2 text-text">{run.workflowName}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {formatRelativeTime(run.startTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
