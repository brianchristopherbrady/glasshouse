import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '../api/client.js';
import type { TraceSpanNode } from '../api/types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Duration, formatRelativeTime } from '../components/Duration.js';
import { TraceView } from '../components/TraceView.js';
import { SpanDetail } from '../components/SpanDetail.js';
import { EvidenceTag } from '../components/EvidenceTag.js';

const TABS = [
  'trace',
  'timeline',
  'files',
  'agents',
  'skills',
  'tools',
  'logs',
  'metrics',
  'github',
  'drift',
] as const;
type Tab = (typeof TABS)[number];

function RunHeader(): JSX.Element | null {
  const { runId } = useParams();
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId!),
    enabled: !!runId,
  });
  if (!run) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">{run.workflowName}</h1>
        <StatusBadge status={run.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div>
          <dt className="text-text-muted">Trigger</dt>
          <dd className="text-text">{run.trigger}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Branch</dt>
          <dd className="mono text-text">{run.branch ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Commit</dt>
          <dd className="mono text-text">{run.commitSha ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Engine</dt>
          <dd className="text-text">{run.engine ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Started</dt>
          <dd className="text-text">{formatRelativeTime(run.startTime)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Duration</dt>
          <dd className="text-text">
            <Duration ms={run.durationMs} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function TraceTab(): JSX.Element {
  const { runId } = useParams();
  const [selectedSpan, setSelectedSpan] = useState<TraceSpanNode | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['run-trace', runId],
    queryFn: () => api.getRunTrace(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading trace…</div>;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <TraceView
        trace={data?.trace ?? []}
        selectedSpanId={selectedSpan?.id ?? null}
        onSelectSpan={setSelectedSpan}
      />
      <SpanDetail span={selectedSpan} />
    </div>
  );
}

function TimelineTab(): JSX.Element {
  const { runId } = useParams();
  const { data: events, isLoading } = useQuery({
    queryKey: ['run-events', runId],
    queryFn: () => api.getRunEvents(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading timeline…</div>;
  return (
    <div className="flex flex-col gap-1">
      {events?.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 rounded border border-border bg-surface-raised px-3 py-2 text-xs"
        >
          <span className="mono w-20 shrink-0 text-text-muted">
            {new Date(e.timestamp).toLocaleTimeString()}
          </span>
          <span className="mono w-44 shrink-0 text-text">{e.kind}</span>
          <span className="flex-1 truncate text-text-muted">
            {e.actorName ?? e.actorType ?? '—'}
          </span>
          <EvidenceTag source={e.evidenceSource} confidence={e.evidenceConfidence} />
        </div>
      ))}
      {events?.length === 0 && <div className="text-text-muted">No events recorded.</div>}
    </div>
  );
}

function FilesTab(): JSX.Element {
  const { runId } = useParams();
  const { data: files, isLoading } = useQuery({
    queryKey: ['run-files', runId],
    queryFn: () => api.getRunFiles(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading files…</div>;
  return (
    <div className="flex flex-col gap-2">
      {files?.map((f) => (
        <div key={f.id} className="rounded border border-border bg-surface-raised p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="mono text-text">{f.path}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-text-muted">
              {f.operation}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-text-muted">
            {f.additions != null && <span className="text-status-success">+{f.additions}</span>}
            {f.deletions != null && <span className="text-status-failure">-{f.deletions}</span>}
          </div>
          {f.diff && (
            <pre className="mono mt-2 max-h-40 overflow-auto rounded bg-surface-sunken p-2 text-[11px] text-text">
              {f.diff}
            </pre>
          )}
        </div>
      ))}
      {files?.length === 0 && <div className="text-text-muted">No file operations recorded.</div>}
    </div>
  );
}

function AgentsTab(): JSX.Element {
  const { runId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['run-agents', runId],
    queryFn: () => api.getRunAgents(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading agents…</div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {data?.agentRuns.map((a) => (
          <div key={a.id} className="rounded border border-border bg-surface-raised p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-text">{a.name}</span>
              <StatusBadge status={a.status} />
            </div>
            <div className="mt-1 text-text-muted">
              {a.parentAgentRunId ? 'Sub-agent' : 'Top-level agent'} ·{' '}
              {new Date(a.startTime).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {data?.agentRuns.length === 0 && (
          <div className="text-text-muted">No agents participated in this run.</div>
        )}
      </div>
      {data && data.handoffs.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Handoffs</div>
          <div className="flex flex-col gap-2">
            {data.handoffs.map((h) => (
              <div
                key={h.id}
                className="rounded border border-border bg-surface-raised p-3 text-xs text-text"
              >
                {h.reason ?? 'No reason recorded.'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsTab(): JSX.Element {
  const { runId } = useParams();
  const { data: usages, isLoading } = useQuery({
    queryKey: ['run-skills', runId],
    queryFn: () => api.getRunSkills(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading skills…</div>;

  const stateLabel = (v: 'true' | 'false' | 'unknown'): string =>
    v === 'true' ? 'Yes' : v === 'false' ? 'No' : 'Unknown';

  return (
    <div className="flex flex-col gap-2">
      {usages?.map((u) => (
        <div key={u.id} className="rounded border border-border bg-surface-raised p-3 text-xs">
          <div className="font-medium text-text">{u.skillDefinition.name}</div>
          <dl className="mt-2 grid grid-cols-5 gap-2 text-text-muted">
            <div>
              <dt>Available</dt>
              <dd className="text-text">{u.available ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Configured</dt>
              <dd className="text-text">{u.configured ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Loaded</dt>
              <dd className={clsx(u.loaded === 'unknown' ? 'text-text-muted' : 'text-text')}>
                {stateLabel(u.loaded)}
              </dd>
            </div>
            <div>
              <dt>Referenced</dt>
              <dd className={clsx(u.referenced === 'unknown' ? 'text-text-muted' : 'text-text')}>
                {stateLabel(u.referenced)}
              </dd>
            </div>
            <div>
              <dt>Runtime evidence</dt>
              <dd
                className={clsx(
                  u.executionEvidence === 'unknown' ? 'text-text-muted' : 'text-text',
                )}
              >
                {stateLabel(u.executionEvidence)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
      {usages?.length === 0 && <div className="text-text-muted">No skill usage recorded.</div>}
    </div>
  );
}

function ToolsTab(): JSX.Element {
  const { runId } = useParams();
  const { data: tools, isLoading } = useQuery({
    queryKey: ['run-tools', runId],
    queryFn: () => api.getRunTools(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading tools…</div>;
  return (
    <div className="flex flex-col gap-2">
      {tools?.map((t) => (
        <div key={t.id} className="rounded border border-border bg-surface-raised p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-text">{t.toolName}</span>
            <StatusBadge status={t.status} />
          </div>
          <div className="mt-1 text-text-muted">
            {t.category} · <Duration ms={t.durationMs} />
          </div>
          {t.resultPreview && (
            <pre className="mono mt-2 overflow-auto rounded bg-surface-sunken p-2 text-[11px] text-text">
              {t.resultPreview}
            </pre>
          )}
        </div>
      ))}
      {tools?.length === 0 && <div className="text-text-muted">No tool calls recorded.</div>}
    </div>
  );
}

function LogsTab(): JSX.Element {
  const { runId } = useParams();
  const { data: logs, isLoading } = useQuery({
    queryKey: ['run-logs', runId],
    queryFn: () => api.getRunLogs(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading logs…</div>;
  return (
    <div className="mono flex flex-col gap-0.5 rounded border border-border bg-surface-sunken p-3 text-xs">
      {logs?.map((l) => (
        <div
          key={l.id}
          className={clsx(
            l.level === 'error' && 'text-status-failure',
            l.level === 'warn' && 'text-status-running',
            (l.level === 'info' || l.level === 'debug') && 'text-text-muted',
          )}
        >
          [{l.source}] {l.message}
        </div>
      ))}
      {logs?.length === 0 && <div className="text-text-muted">No logs recorded.</div>}
    </div>
  );
}

function MetricsTab(): JSX.Element {
  const { runId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['run-metrics', runId],
    queryFn: () => api.getRunMetrics(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading metrics…</div>;
  const unavailable = (v: number | null) => (v == null ? 'Unavailable' : v);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        ['Model calls', data?.modelCallCount],
        ['Tokens in', data ? unavailable(data.tokensInput) : undefined],
        ['Tokens out', data ? unavailable(data.tokensOutput) : undefined],
        ['Cost (USD)', data ? unavailable(data.costUsd) : undefined],
        ['Tool calls', data?.toolCallCount],
        ['Files changed', data?.filesChanged],
      ].map(([label, value]) => (
        <div key={label as string} className="rounded border border-border bg-surface-raised p-3">
          <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
          <div className="mt-1 text-xl font-semibold text-text">{value ?? 'Unavailable'}</div>
        </div>
      ))}
    </div>
  );
}

function GithubTab(): JSX.Element {
  const { runId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['run-github', runId],
    queryFn: () => api.getRunGithub(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading GitHub activity…</div>;
  return (
    <div className="flex flex-col gap-4 text-xs">
      <div>
        <div className="mb-1 uppercase tracking-wide text-text-muted">Pull requests</div>
        {data?.pullRequests.map((pr) => (
          <a
            key={pr.id}
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded border border-border bg-surface-raised p-2 text-accent hover:underline"
          >
            #{pr.number} {pr.title}
          </a>
        ))}
        {data?.pullRequests.length === 0 && <div className="text-text-muted">None.</div>}
      </div>
      <div>
        <div className="mb-1 uppercase tracking-wide text-text-muted">Issues</div>
        {data?.issues.map((i) => (
          <a
            key={i.id}
            href={i.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded border border-border bg-surface-raised p-2 text-accent hover:underline"
          >
            #{i.number} {i.title}
          </a>
        ))}
        {data?.issues.length === 0 && <div className="text-text-muted">None.</div>}
      </div>
      <div>
        <div className="mb-1 uppercase tracking-wide text-text-muted">Checks</div>
        {data?.checks.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded border border-border bg-surface-raised p-2"
          >
            <span className="text-text">{c.name}</span>
            <StatusBadge status={c.status} />
          </div>
        ))}
        {data?.checks.length === 0 && <div className="text-text-muted">None.</div>}
      </div>
    </div>
  );
}

function DriftTab(): JSX.Element {
  const { runId } = useParams();
  const { data: findings, isLoading } = useQuery({
    queryKey: ['run-drift', runId],
    queryFn: () => api.getRunDrift(runId!),
    enabled: !!runId,
  });
  if (isLoading) return <div className="text-text-muted">Loading drift findings…</div>;
  if (!findings || findings.length === 0) {
    return (
      <div className="text-text-muted">
        No drift detected — observed execution matched the declared architecture.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {findings.map((f) => (
        <div
          key={f.id}
          className="rounded border border-status-running/40 bg-surface-raised p-3 text-xs"
        >
          <div className="mono text-status-running">{f.kind}</div>
          <div className="mt-1 text-text">{f.description}</div>
          {(f.expected || f.observed) && (
            <div className="mono mt-2 grid grid-cols-2 gap-2 text-text-muted">
              <div>
                <div className="uppercase">Expected</div>
                <div className="text-text">{f.expected ?? 'Unavailable'}</div>
              </div>
              <div>
                <div className="uppercase">Observed</div>
                <div className="text-text">{f.observed ?? 'Unavailable'}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RunDetailPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('trace');

  return (
    <div className="flex flex-col gap-4">
      <RunHeader />
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div>
        {tab === 'trace' && <TraceTab />}
        {tab === 'timeline' && <TimelineTab />}
        {tab === 'files' && <FilesTab />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'skills' && <SkillsTab />}
        {tab === 'tools' && <ToolsTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'metrics' && <MetricsTab />}
        {tab === 'github' && <GithubTab />}
        {tab === 'drift' && <DriftTab />}
      </div>
    </div>
  );
}
