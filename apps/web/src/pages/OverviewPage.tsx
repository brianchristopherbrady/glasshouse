import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PlayCircle,
  CheckCircle2,
  Timer,
  GitMerge,
  GitBranch,
  Users,
  Sparkles,
  Wrench,
  FileText,
  GitPullRequest,
  TriangleAlert,
} from 'lucide-react';
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
      <div className="rounded-lg border border-status-failure/40 bg-status-failure-wash p-4 text-status-failure">
        Failed to load repository overview.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Metric label="Total runs" value={data.totalRuns} icon={PlayCircle} />
        <Metric label="Success rate" value={pct(data.successRate)} icon={CheckCircle2} />
        <Metric label="Avg duration" value={formatDuration(data.averageDurationMs)} icon={Timer} />
        <Metric label="Handoffs" value={data.handoffCount} icon={GitMerge} />
        <Metric label="Workflows" value={data.workflowDefCount} icon={GitBranch} />
        <Metric label="Agents configured" value={data.agentDefCount} icon={Users} />
        <Metric label="Skills configured" value={data.skillDefCount} icon={Sparkles} />
        <Metric label="Tool calls" value={data.toolCallCount} icon={Wrench} />
        <Metric label="Files changed" value={data.fileOpCount} icon={FileText} />
        <Metric label="Pull requests" value={data.pullRequestCount} icon={GitPullRequest} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text">Recent runs</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Workflow</th>
                <th className="px-4 py-2.5 font-medium">Trigger</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map((run) => (
                <tr
                  key={run.id}
                  className="group cursor-pointer border-t border-border transition-colors first:border-t-0 hover:bg-surface-sunken"
                  onClick={() => navigate(`/repos/${repoId}/runs/${run.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text group-hover:text-accent">
                    {run.workflowName}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{run.trigger}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {formatRelativeTime(run.startTime)}
                  </td>
                  <td className="px-4 py-2.5">
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
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text">
            <TriangleAlert size={14} className="text-status-failure" />
            Recent failures
          </h2>
          <div className="overflow-hidden rounded-lg border border-status-failure/30 bg-surface-raised shadow-raised">
            <table className="w-full text-left text-sm">
              <tbody>
                {data.failingRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="group cursor-pointer border-t border-status-failure/15 transition-colors first:border-t-0 hover:bg-status-failure-wash"
                    onClick={() => navigate(`/repos/${repoId}/runs/${run.id}`)}
                  >
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text group-hover:text-accent">
                      {run.workflowName}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">
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
