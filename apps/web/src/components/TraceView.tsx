import { useMemo } from 'react';
import clsx from 'clsx';
import type { TraceSpanNode } from '../api/types.js';
import { formatDuration } from './Duration.js';

const TYPE_COLORS: Record<string, string> = {
  workflow: 'bg-accent/70',
  job: 'bg-sky-600/70',
  step: 'bg-sky-500/60',
  agent: 'bg-emerald-600/70',
  subagent: 'bg-emerald-500/60',
  skill: 'bg-purple-600/70',
  model: 'bg-fuchsia-600/70',
  tool: 'bg-amber-600/70',
  mcp: 'bg-amber-500/60',
  shell: 'bg-orange-600/70',
  file: 'bg-cyan-600/70',
  git: 'bg-cyan-500/60',
  test: 'bg-lime-600/70',
  http: 'bg-slate-500/60',
  github: 'bg-slate-600/70',
  custom: 'bg-zinc-500/60',
};

interface FlatSpan extends TraceSpanNode {
  depth: number;
}

function flatten(nodes: TraceSpanNode[], depth = 0): FlatSpan[] {
  const out: FlatSpan[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export function TraceView({
  trace,
  selectedSpanId,
  onSelectSpan,
}: {
  trace: TraceSpanNode[];
  selectedSpanId: string | null;
  onSelectSpan: (span: TraceSpanNode) => void;
}): JSX.Element {
  const flat = useMemo(() => flatten(trace), [trace]);
  const [rootStart, totalMs] = useMemo(() => {
    if (flat.length === 0) return [0, 1];
    const starts = flat.map((s) => new Date(s.startTime).getTime());
    const ends = flat.map((s) =>
      s.endTime ? new Date(s.endTime).getTime() : new Date(s.startTime).getTime(),
    );
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    return [min, Math.max(max - min, 1)];
  }, [flat]);

  if (flat.length === 0) {
    return <div className="text-text-muted">No span data recorded for this run.</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex flex-col gap-1">
        {flat.map((span) => {
          const start = new Date(span.startTime).getTime();
          const end = span.endTime ? new Date(span.endTime).getTime() : start;
          const leftPct = ((start - rootStart) / totalMs) * 100;
          const widthPct = Math.max(((end - start) / totalMs) * 100, 0.4);
          const isSelected = span.id === selectedSpanId;
          return (
            <button
              key={span.id}
              type="button"
              onClick={() => onSelectSpan(span)}
              className={clsx(
                'group flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors',
                isSelected ? 'bg-surface-sunken' : 'hover:bg-surface-sunken/60',
              )}
              style={{ paddingLeft: `${span.depth * 16 + 4}px` }}
            >
              <span className="w-52 shrink-0 truncate text-xs text-text">
                <span className="mono mr-1 text-text-muted">{span.type}</span>
                {span.name}
              </span>
              <span className="relative h-4 flex-1 rounded bg-surface-sunken">
                <span
                  className={clsx(
                    'absolute top-0 h-4 rounded',
                    TYPE_COLORS[span.type] ?? TYPE_COLORS.custom,
                    span.status === 'failure' && 'ring-2 ring-status-failure',
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${span.name} — ${formatDuration(span.durationMs)}`}
                />
              </span>
              <span className="mono w-16 shrink-0 text-right text-xs text-text-muted">
                {formatDuration(span.durationMs)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
