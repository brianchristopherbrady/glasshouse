import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeftRight, Bookmark, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api/client.js';
import type { FileOperation, RunDefinitionFile, WorkflowRun } from '../api/types.js';
import { DiffView } from '../components/ChangedFiles.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatDuration, formatRelativeTime } from '../components/Duration.js';
import { unifiedDiff } from '../compare/lineDiff.js';

function useRunBundle(runId: string | null) {
  const enabled = !!runId;
  const id = runId ?? '';
  const run = useQuery({ queryKey: ['run', id], queryFn: () => api.getRun(id), enabled });
  const files = useQuery({
    queryKey: ['run-files', id],
    queryFn: () => api.getRunFiles(id),
    enabled,
  });
  const agents = useQuery({
    queryKey: ['run-agents', id],
    queryFn: () => api.getRunAgents(id),
    enabled,
  });
  const skills = useQuery({
    queryKey: ['run-skills', id],
    queryFn: () => api.getRunSkills(id),
    enabled,
  });
  const metrics = useQuery({
    queryKey: ['run-metrics', id],
    queryFn: () => api.getRunMetrics(id),
    enabled,
  });
  const definitions = useQuery({
    queryKey: ['run-definitions', id],
    queryFn: () => api.getRunDefinitions(id),
    enabled,
  });
  const all = [run, files, agents, skills, metrics, definitions];
  if (!enabled || all.some((q) => !q.data)) {
    return { loading: enabled && all.some((q) => q.isLoading), data: null };
  }
  const changes = files.data!.filter((f) => f.operation !== 'read');
  const agentNames = new Map(agents.data!.agentRuns.map((a) => [a.id, a.name]));
  return {
    loading: false,
    data: {
      run: run.data!,
      changes,
      agentRuns: [...agents.data!.agentRuns].sort((x, y) => x.startTime.localeCompare(y.startTime)),
      handoffs: agents.data!.handoffs.map(
        (h) =>
          `${agentNames.get(h.fromAgentRunId) ?? '?'} → ${agentNames.get(h.toAgentRunId) ?? '?'}`,
      ),
      skills: [
        ...new Set(
          skills.data!.filter((s) => s.loaded === 'true').map((s) => s.skillDefinition.name),
        ),
      ].sort(),
      metrics: metrics.data!,
      definitions: definitions.data!,
      additions: changes.reduce((sum, f) => sum + (f.additions ?? 0), 0),
      deletions: changes.reduce((sum, f) => sum + (f.deletions ?? 0), 0),
    },
  };
}

type Bundle = NonNullable<ReturnType<typeof useRunBundle>['data']>;

function runLabel(run: WorkflowRun): string {
  const name =
    run.workflowName.length > 60 ? `${run.workflowName.slice(0, 57)}…` : run.workflowName;
  return `${run.savedLabel ? `${run.savedLabel} — ` : ''}${name} (${formatRelativeTime(run.startTime)})`;
}

function RunPicker({
  label,
  value,
  runs,
  onChange,
}: {
  label: string;
  value: string | null;
  runs: WorkflowRun[];
  onChange: (id: string) => void;
}): JSX.Element {
  const saved = runs.filter((r) => r.savedAt);
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-text-muted">
      {label}
      <select
        className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm font-normal text-text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Choose a run…
        </option>
        {saved.length > 0 && (
          <optgroup label="Saved runs">
            {saved.map((r) => (
              <option key={r.id} value={r.id}>
                {runLabel(r)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="All runs">
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {runLabel(r)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Delta({ a, b, unit = '' }: { a: number | null; b: number | null; unit?: string }) {
  if (a == null || b == null || a === b) return <span className="text-text-faint">—</span>;
  const d = b - a;
  return (
    <span className="mono tabular-nums text-text">
      {d > 0 ? '+' : '−'}
      {Math.abs(d)}
      {unit}
    </span>
  );
}

function SummaryTable({ a, b }: { a: Bundle; b: Bundle }): JSX.Element {
  const rows: Array<{ label: string; a: ReactNode; b: ReactNode; delta?: ReactNode }> = [
    {
      label: 'Status',
      a: <StatusBadge status={a.run.status} />,
      b: <StatusBadge status={b.run.status} />,
    },
    {
      label: 'Started',
      a: formatRelativeTime(a.run.startTime),
      b: formatRelativeTime(b.run.startTime),
    },
    {
      label: 'Duration',
      a: formatDuration(a.run.durationMs),
      b: formatDuration(b.run.durationMs),
      delta:
        a.run.durationMs != null &&
        b.run.durationMs != null &&
        a.run.durationMs !== b.run.durationMs
          ? `${b.run.durationMs > a.run.durationMs ? '+' : '−'}${formatDuration(Math.abs(b.run.durationMs - a.run.durationMs))}`
          : undefined,
    },
    { label: 'Engine', a: a.run.engine ?? 'Unavailable', b: b.run.engine ?? 'Unavailable' },
    {
      label: 'Commit',
      a: <span className="mono">{a.run.commitSha?.slice(0, 12) ?? 'Unavailable'}</span>,
      b: <span className="mono">{b.run.commitSha?.slice(0, 12) ?? 'Unavailable'}</span>,
    },
    {
      label: 'Files changed',
      a: new Set(a.changes.map((f) => f.path)).size,
      b: new Set(b.changes.map((f) => f.path)).size,
      delta: (
        <Delta
          a={new Set(a.changes.map((f) => f.path)).size}
          b={new Set(b.changes.map((f) => f.path)).size}
        />
      ),
    },
    {
      label: 'Lines added',
      a: a.additions,
      b: b.additions,
      delta: <Delta a={a.additions} b={b.additions} />,
    },
    {
      label: 'Lines removed',
      a: a.deletions,
      b: b.deletions,
      delta: <Delta a={a.deletions} b={b.deletions} />,
    },
    {
      label: 'Tool calls',
      a: a.metrics.toolCallCount,
      b: b.metrics.toolCallCount,
      delta: <Delta a={a.metrics.toolCallCount} b={b.metrics.toolCallCount} />,
    },
    {
      label: 'Agent turns',
      a: a.agentRuns.length,
      b: b.agentRuns.length,
      delta: <Delta a={a.agentRuns.length} b={b.agentRuns.length} />,
    },
    {
      label: 'Handoffs',
      a: a.handoffs.length,
      b: b.handoffs.length,
      delta: <Delta a={a.handoffs.length} b={b.handoffs.length} />,
    },
    {
      label: 'Skills loaded',
      a: a.skills.length,
      b: b.skills.length,
      delta: <Delta a={a.skills.length} b={b.skills.length} />,
    },
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised shadow-raised">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium" />
            <th className="px-4 py-2.5 font-medium">A · baseline</th>
            <th className="px-4 py-2.5 font-medium">B · compared</th>
            <th className="px-4 py-2.5 font-medium">B − A</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border first:border-t-0">
              <th scope="row" className="px-4 py-2 text-xs font-medium text-text-muted">
                {row.label}
              </th>
              <td className="px-4 py-2 text-text">{row.a}</td>
              <td className="px-4 py-2 text-text">{row.b}</td>
              <td className="px-4 py-2 text-xs">
                {row.delta ?? <span className="text-text-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DefinitionChange = {
  path: string;
  kind: string;
  status: 'changed' | 'added' | 'removed' | 'same';
  diff: ReturnType<typeof unifiedDiff>;
};

function compareDefinitions(a: RunDefinitionFile[], b: RunDefinitionFile[]): DefinitionChange[] {
  const before = new Map(a.map((d) => [d.path, d]));
  const after = new Map(b.map((d) => [d.path, d]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.map((path) => {
    const x = before.get(path);
    const y = after.get(path);
    const status = !x ? 'added' : !y ? 'removed' : x.sha256 === y.sha256 ? 'same' : 'changed';
    return {
      path,
      kind: (y ?? x)!.kind,
      status,
      diff:
        status === 'same'
          ? { diff: '', additions: 0, deletions: 0 }
          : unifiedDiff(x?.content ?? '', y?.content ?? ''),
    };
  });
}

const CHANGE_STYLES: Record<DefinitionChange['status'], string> = {
  changed: 'bg-status-running-wash text-status-running',
  added: 'bg-status-success-wash text-status-success',
  removed: 'bg-status-failure-wash text-status-failure',
  same: 'bg-surface-sunken text-text-muted',
};

function Expandable({
  header,
  children,
  defaultOpen = false,
}: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-xs hover:bg-surface-overlay"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        )}
        {header}
      </button>
      {open && children}
    </li>
  );
}

function SetupChanges({ a, b }: { a: Bundle; b: Bundle }): JSX.Element {
  const missing = [a, b].filter((x) => !x.definitions.capturedAt);
  const changes = useMemo(
    () => compareDefinitions(a.definitions.definitions, b.definitions.definitions),
    [a.definitions, b.definitions],
  );
  if (missing.length > 0) {
    return (
      <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted shadow-raised">
        {missing.length === 2
          ? 'Neither run has a'
          : `${missing[0] === a ? 'Run A' : 'Run B'} has no`}{' '}
        snapshot of its agents, skills, and prompts. Glasshouse records one when a local agent
        session starts; runs recorded before this feature, and GitHub Actions runs, don&apos;t have
        one (compare their commits instead).
      </p>
    );
  }
  const different = changes.filter((c) => c.status !== 'same');
  const same = changes.length - different.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">
        {different.length === 0
          ? `Both runs used identical definitions (${same} files).`
          : `${different.length} of ${changes.length} definition files differ; ${same} unchanged.`}
      </p>
      {different.length > 0 && (
        <ul className="flex flex-col gap-2">
          {different.map((c) => (
            <Expandable
              key={c.path}
              defaultOpen={different.length <= 3}
              header={
                <>
                  <span
                    className={clsx(
                      'rounded-sm px-1.5 py-0.5 text-[11px] font-semibold',
                      CHANGE_STYLES[c.status],
                    )}
                  >
                    {c.status}
                  </span>
                  <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-muted">
                    {c.kind}
                  </span>
                  <span className="mono min-w-0 flex-1 break-all text-text">{c.path}</span>
                  <span className="mono tabular-nums">
                    <span className="text-status-success">+{c.diff.additions}</span>{' '}
                    <span className="text-status-failure">−{c.diff.deletions}</span>
                  </span>
                </>
              }
            >
              <DiffView diff={c.diff.diff} />
            </Expandable>
          ))}
        </ul>
      )}
    </div>
  );
}

function SideBySide({ a, b }: { a: ReactNode; b: ReactNode }): JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[a, b].map((content, i) => (
        <div
          key={i}
          className="min-w-0 rounded-lg border border-border bg-surface-raised p-3 text-sm shadow-raised"
        >
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {i === 0 ? 'A · baseline' : 'B · compared'}
          </div>
          {content}
        </div>
      ))}
    </div>
  );
}

function AgentsColumn({ bundle }: { bundle: Bundle }): JSX.Element {
  if (bundle.agentRuns.length === 0)
    return <p className="text-xs text-text-muted">No agents recorded.</p>;
  return (
    <div className="flex flex-col gap-3 text-xs">
      <ol className="flex flex-col gap-1">
        {bundle.agentRuns.map((agent) => (
          <li key={agent.id} className="flex items-center gap-2">
            <StatusBadge status={agent.status} />
            <span className="text-text">{agent.name}</span>
            {agent.parentAgentRunId && <span className="text-text-faint">subagent</span>}
          </li>
        ))}
      </ol>
      {bundle.handoffs.length > 0 && (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Handoffs
          </div>
          <ol className="mt-1 flex flex-col gap-0.5 text-text">
            {bundle.handoffs.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </div>
      )}
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Skills loaded
        </div>
        <p className="mt-1 text-text">{bundle.skills.length ? bundle.skills.join(', ') : 'None'}</p>
      </div>
    </div>
  );
}

function opsSummary(ops: FileOperation[]): ReactNode {
  if (ops.length === 0) return <span className="text-text-faint">not changed</span>;
  return (
    <span className="mono tabular-nums">
      <span className="text-status-success">
        +{ops.reduce((s, f) => s + (f.additions ?? 0), 0)}
      </span>{' '}
      <span className="text-status-failure">
        −{ops.reduce((s, f) => s + (f.deletions ?? 0), 0)}
      </span>
    </span>
  );
}

function OpsDiffs({ ops }: { ops: FileOperation[] }): JSX.Element {
  if (ops.length === 0)
    return <p className="text-xs text-text-muted">This run didn&apos;t change the file.</p>;
  return (
    <div className="-mx-3 -mb-3 flex flex-col">
      {ops.map((op) =>
        op.diff ? (
          <DiffView key={op.id} diff={op.diff} />
        ) : (
          <p key={op.id} className="px-3 pb-3 text-xs text-text-muted">
            {op.operation}, no diff recorded.
          </p>
        ),
      )}
    </div>
  );
}

function FileChanges({ a, b }: { a: Bundle; b: Bundle }): JSX.Element {
  const paths = [...new Set([...a.changes, ...b.changes].map((f) => f.path))].sort();
  if (paths.length === 0)
    return <p className="text-xs text-text-muted">Neither run changed any files.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {paths.map((path) => {
        const opsA = a.changes.filter((f) => f.path === path);
        const opsB = b.changes.filter((f) => f.path === path);
        const verdict =
          opsA.length === 0
            ? 'only in B'
            : opsB.length === 0
              ? 'only in A'
              : opsA.map((f) => f.diff).join('\n') === opsB.map((f) => f.diff).join('\n')
                ? 'same change'
                : 'different change';
        return (
          <Expandable
            key={path}
            header={
              <>
                <span className="mono min-w-0 flex-1 break-all text-text">{path}</span>
                <span className="text-text-muted">A {opsSummary(opsA)}</span>
                <span className="text-text-muted">B {opsSummary(opsB)}</span>
                <span
                  className={clsx(
                    'rounded-sm px-1.5 py-0.5 text-[11px] font-semibold',
                    verdict === 'same change'
                      ? 'bg-surface-sunken text-text-muted'
                      : 'bg-status-running-wash text-status-running',
                  )}
                >
                  {verdict}
                </span>
              </>
            }
          >
            <div className="border-t border-border p-3">
              <SideBySide a={<OpsDiffs ops={opsA} />} b={<OpsDiffs ops={opsB} />} />
            </div>
          </Expandable>
        );
      })}
    </ul>
  );
}

export function ComparePage(): JSX.Element {
  const { repoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: runs, isLoading } = useQuery({
    queryKey: ['runs', repoId, 'compare'],
    queryFn: () => api.listRuns(repoId!),
    enabled: !!repoId,
  });

  // Unset sides default to the newest saved run (A) and the newest other run (B).
  const requestedA = searchParams.get('a');
  const requestedB = searchParams.get('b');
  const newestSaved = runs?.find((r) => r.savedAt && r.id !== requestedB)?.id ?? null;
  const aId = requestedA ?? newestSaved;
  const bId = requestedB ?? runs?.find((r) => r.id !== aId)?.id ?? null;

  const a = useRunBundle(aId);
  const b = useRunBundle(bId);

  function select(side: 'a' | 'b', id: string): void {
    const next = new URLSearchParams(searchParams);
    if (aId) next.set('a', aId);
    if (bId) next.set('b', bId);
    next.set(side, id);
    setSearchParams(next, { replace: true });
  }

  function swap(): void {
    if (!aId || !bId) return;
    setSearchParams({ a: bId, b: aId }, { replace: true });
  }

  if (isLoading) return <div className="text-text-muted">Loading runs…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Compare runs</h1>
        <p className="mt-1 text-xs text-text-muted">
          Save a run as a baseline (<Bookmark size={11} className="inline" aria-hidden="true" /> on
          the run page), change an agent, skill, or prompt, run it again, then compare the setup
          each run started with and what each one did.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 shadow-raised sm:flex-row sm:items-end">
        <RunPicker
          label="A · baseline"
          value={aId}
          runs={runs ?? []}
          onChange={(id) => select('a', id)}
        />
        <button
          type="button"
          onClick={swap}
          disabled={!aId || !bId}
          aria-label="Swap A and B"
          title="Swap A and B"
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-md border border-border text-text-muted enabled:hover:text-text disabled:opacity-50 sm:self-end"
        >
          <ArrowLeftRight size={15} aria-hidden="true" />
        </button>
        <RunPicker
          label="B · compared"
          value={bId}
          runs={runs ?? []}
          onChange={(id) => select('b', id)}
        />
      </div>

      {(!aId || !bId) && <p className="text-sm text-text-muted">Pick two runs to compare.</p>}
      {aId && bId && aId === bId && (
        <p className="text-sm text-text-muted">A and B are the same run; pick a different one.</p>
      )}
      {(a.loading || b.loading) && <p className="text-sm text-text-muted">Loading runs…</p>}

      {a.data && b.data && aId !== bId && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {[a.data, b.data].map((bundle, i) => (
              <Link
                key={i}
                to={`/repos/${repoId}/runs/${bundle.run.id}`}
                className="min-w-0 rounded-lg border border-border bg-surface-raised p-3 shadow-raised hover:border-accent"
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {i === 0 ? 'A · baseline' : 'B · compared'}
                  {bundle.run.savedLabel && (
                    <span className="ml-2 normal-case text-accent">{bundle.run.savedLabel}</span>
                  )}
                </div>
                <div className="mt-1 truncate font-medium text-text">{bundle.run.workflowName}</div>
              </Link>
            ))}
          </div>

          <Section title="Summary">
            <SummaryTable a={a.data} b={b.data} />
          </Section>

          <Section
            title="Setup changes"
            note="Agent, skill, prompt, instruction, and hook files as each run found them when it started."
          >
            <SetupChanges a={a.data} b={b.data} />
          </Section>

          <Section title="Agents, handoffs, and skills">
            <SideBySide a={<AgentsColumn bundle={a.data} />} b={<AgentsColumn bundle={b.data} />} />
          </Section>

          <Section
            title="Changed files"
            note="Every file either run changed. Expand one to see both diffs."
          >
            <FileChanges a={a.data} b={b.data} />
          </Section>
        </>
      )}
    </div>
  );
}
