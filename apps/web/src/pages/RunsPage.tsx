import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, GitCompareArrows } from 'lucide-react';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Duration, formatRelativeTime } from '../components/Duration.js';

const STATUS_OPTIONS = ['all', 'success', 'failure', 'running', 'pending'] as const;
const SOURCE_PARAMS = ['workflow', 'prompt'] as const;

export function RunsPage(): JSX.Element {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const workflowId = searchParams.get('workflow') ?? undefined;
  const promptId = searchParams.get('prompt') ?? undefined;
  const source = workflowId ? `workflow:${workflowId}` : promptId ? `prompt:${promptId}` : 'all';

  const { data: workflows } = useQuery({
    queryKey: ['workflows', repoId],
    queryFn: () => api.listWorkflows(repoId!),
    enabled: !!repoId,
  });
  const { data: prompts } = useQuery({
    queryKey: ['prompts', repoId],
    queryFn: () => api.listPrompts(repoId!),
    enabled: !!repoId,
  });

  const { data: runs, isLoading } = useQuery({
    queryKey: ['runs', repoId, status, workflowId, promptId, savedOnly],
    queryFn: () =>
      api.listRuns(repoId!, {
        status: status === 'all' ? undefined : status,
        workflowId,
        promptId,
        saved: savedOnly,
      }),
    enabled: !!repoId,
    // New local agent sessions show up without a manual refresh.
    refetchInterval: 4000,
  });

  function selectSource(value: string): void {
    const [kind, id] = value.split(':') as [string, string | undefined];
    const next = new URLSearchParams(searchParams);
    for (const key of SOURCE_PARAMS) next.delete(key);
    if (id) next.set(kind, id);
    setSearchParams(next, { replace: true });
  }

  function toggleSelected(runId: string): void {
    setSelected((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId].slice(-2),
    );
  }

  function compareSelected(): void {
    // The older run is the baseline.
    const [a, b] = [...selected].sort((x, y) => {
      const start = (id: string) => runs?.find((r) => r.id === id)?.startTime ?? '';
      return start(x).localeCompare(start(y));
    });
    navigate(`/repos/${repoId}/compare?a=${a}&b=${b}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Runs</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={compareSelected}
            disabled={selected.length !== 2}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text enabled:hover:border-accent enabled:hover:text-accent disabled:text-text-muted disabled:opacity-60"
          >
            <GitCompareArrows size={14} aria-hidden="true" />
            Compare {selected.length}/2
          </button>
          <label className="flex items-center gap-1.5 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(e) => setSavedOnly(e.target.checked)}
            />
            Saved only
          </label>
          <select
            className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text"
            value={source}
            onChange={(e) => selectSource(e.target.value)}
            aria-label="Filter by workflow or prompt file"
          >
            <option value="all">All workflows and prompts</option>
            {!!workflows?.length && (
              <optgroup label="Agentic workflows">
                {workflows.map((wf) => (
                  <option key={wf.id} value={`workflow:${wf.id}`}>
                    {wf.name}
                  </option>
                ))}
              </optgroup>
            )}
            {!!prompts?.length && (
              <optgroup label="Prompt files">
                {prompts.map((p) => (
                  <option key={p.id} value={`prompt:${p.id}`}>
                    /{p.command}
                  </option>
                ))}
              </optgroup>
            )}
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
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised shadow-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="w-10 px-4 py-2.5 font-medium">
                  <span className="sr-only">Select to compare</span>
                </th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Workflow</th>
                <th className="px-4 py-2.5 font-medium">Trigger</th>
                <th className="px-4 py-2.5 font-medium">Branch</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Engine</th>
              </tr>
            </thead>
            <tbody>
              {runs?.map((run) => (
                <tr
                  key={run.id}
                  className="group cursor-pointer border-t border-border transition-colors first:border-t-0 hover:bg-surface-sunken"
                  onClick={() => navigate(`/repos/${repoId}/runs/${run.id}`)}
                >
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(run.id)}
                      onChange={() => toggleSelected(run.id)}
                      aria-label={`Select ${run.workflowName} to compare`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text group-hover:text-accent">
                    {run.workflowName}
                    {run.savedAt && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-accent-wash px-1.5 py-0.5 align-middle text-[11px] font-medium text-accent">
                        <Bookmark size={11} aria-hidden="true" />
                        {run.savedLabel ?? 'Saved'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{run.trigger}</td>
                  <td className="mono px-4 py-2.5 text-text-muted">{run.branch ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {formatRelativeTime(run.startTime)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Duration ms={run.durationMs} />
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{run.engine ?? 'Unavailable'}</td>
                </tr>
              ))}
              {runs?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
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
