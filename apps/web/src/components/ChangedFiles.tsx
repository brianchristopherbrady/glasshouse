import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Eye, FileDiff } from 'lucide-react';
import type { FileOperation } from '../api/types.js';
import { EvidenceTag } from './EvidenceTag.js';

const OPERATION_META: Record<string, { letter: string; label: string; className: string }> = {
  created: { letter: 'A', label: 'Added', className: 'bg-status-success-wash text-status-success' },
  modified: {
    letter: 'M',
    label: 'Modified',
    className: 'bg-status-running-wash text-status-running',
  },
  deleted: {
    letter: 'D',
    label: 'Deleted',
    className: 'bg-status-failure-wash text-status-failure',
  },
  renamed: { letter: 'R', label: 'Renamed', className: 'bg-accent-wash text-accent' },
  committed: { letter: 'C', label: 'Committed', className: 'bg-accent-wash text-accent' },
};

// Provenance groups, most direct evidence first. Changes are never merged
// across sources: "the run wrote this file" and "this file was in the commit
// the run executed against" are different claims.
const SOURCE_GROUPS: Record<string, { order: number; title: string; description: string }> = {
  runtime: {
    order: 0,
    title: 'Changed during the run',
    description: 'Reported by runtime telemetry while the run was executing.',
  },
  git: {
    order: 1,
    title: "Changed in the run's commits",
    description: 'Taken from git history of commits the run produced.',
  },
  artifact: {
    order: 2,
    title: 'From run artifacts',
    description: 'Reconstructed from artifacts the run uploaded.',
  },
  'github-api': {
    order: 3,
    title: 'Triggering commit',
    description:
      'Files changed by the commit this run executed against — context, not proof the run wrote them.',
  },
};

function groupMeta(source: string) {
  return SOURCE_GROUPS[source] ?? { order: 9, title: `Source: ${source}`, description: '' };
}

function DiffView({ diff }: { diff: string }): JSX.Element {
  return (
    <pre className="mono max-h-96 overflow-auto border-t border-border bg-surface-sunken text-[11px] leading-5">
      {diff.split('\n').map((line, i) => (
        <div
          key={i}
          className={clsx(
            'whitespace-pre px-3',
            line.startsWith('+') && 'bg-status-success-wash text-status-success',
            line.startsWith('-') && 'bg-status-failure-wash text-status-failure',
            line.startsWith('@@') && 'text-accent',
            !/^[+\-@]/.test(line) && 'text-text-muted',
          )}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}

function FileRow({
  file,
  expanded,
  onToggle,
}: {
  file: FileOperation;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const op = OPERATION_META[file.operation] ?? {
    letter: '?',
    label: file.operation,
    className: 'bg-surface-sunken text-text-muted',
  };
  const diffId = `diff-${file.id}`;
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-raised">
      <button
        type="button"
        onClick={onToggle}
        disabled={!file.diff}
        aria-expanded={file.diff ? expanded : undefined}
        aria-controls={file.diff ? diffId : undefined}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-xs enabled:hover:bg-surface-overlay"
      >
        {file.diff ? (
          expanded ? (
            <ChevronDown size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
          )
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span
          className={clsx(
            'mono flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold',
            op.className,
          )}
          title={op.label}
        >
          <span aria-hidden="true">{op.letter}</span>
          <span className="sr-only">{op.label}</span>
        </span>
        <span className="mono min-w-0 flex-1 break-all text-text">
          {file.previousPath && (
            <>
              <span className="text-text-muted">{file.previousPath}</span>
              <span className="px-1 text-text-faint" aria-label="renamed to">
                →
              </span>
            </>
          )}
          {file.path}
        </span>
        <span className="mono flex shrink-0 gap-2 tabular-nums">
          {file.additions != null && <span className="text-status-success">+{file.additions}</span>}
          {file.deletions != null && <span className="text-status-failure">−{file.deletions}</span>}
        </span>
        {file.actorId && (
          <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-muted">
            by {file.actorId}
          </span>
        )}
        <EvidenceTag source={file.evidenceSource} confidence={file.evidenceConfidence} />
      </button>
      {file.diff && expanded && (
        <div id={diffId}>
          <DiffView diff={file.diff} />
        </div>
      )}
    </li>
  );
}

/** Every file a run changed, grouped by how we know it changed. */
export function ChangedFiles({ files }: { files: FileOperation[] }): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showReads, setShowReads] = useState(false);

  const changes = useMemo(() => files.filter((f) => f.operation !== 'read'), [files]);
  const reads = useMemo(() => files.filter((f) => f.operation === 'read'), [files]);
  const groups = useMemo(() => {
    const bySource = new Map<string, FileOperation[]>();
    for (const f of changes)
      bySource.set(f.evidenceSource, [...(bySource.get(f.evidenceSource) ?? []), f]);
    return [...bySource.entries()].sort(([a], [b]) => groupMeta(a).order - groupMeta(b).order);
  }, [changes]);

  const uniquePaths = new Set(changes.map((f) => f.path)).size;
  const additions = changes.reduce((sum, f) => sum + (f.additions ?? 0), 0);
  const deletions = changes.reduce((sum, f) => sum + (f.deletions ?? 0), 0);
  const withDiff = changes.filter((f) => f.diff).map((f) => f.id);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted shadow-raised">
        No file changes were recorded for this run. Changes appear here from runtime telemetry
        (file.* events), the run's git commits, or — for synced GitHub Actions runs — the triggering
        commit.
      </div>
    );
  }

  return (
    <section aria-labelledby="changed-files-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 shadow-raised">
        <div className="flex items-center gap-2">
          <FileDiff size={16} className="text-accent" aria-hidden="true" />
          <h2 id="changed-files-heading" className="text-sm font-semibold text-text">
            {uniquePaths} {uniquePaths === 1 ? 'file' : 'files'} changed
          </h2>
          <span className="mono text-xs tabular-nums">
            <span className="text-status-success">+{additions}</span>{' '}
            <span className="text-status-failure">−{deletions}</span>
          </span>
        </div>
        {withDiff.length > 0 && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setExpanded(new Set(withDiff))}
              className="rounded-md border border-border px-2 py-1 text-text-muted hover:text-text"
            >
              Expand all diffs
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              className="rounded-md border border-border px-2 py-1 text-text-muted hover:text-text"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {groups.map(([source, groupFiles]) => {
        const meta = groupMeta(source);
        const note = groupFiles.find((f) => f.evidenceNote)?.evidenceNote;
        return (
          <div key={source} className="flex flex-col gap-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {meta.title} <span className="text-text-faint">({groupFiles.length})</span>
              </h3>
              <p className="mt-0.5 text-xs text-text-faint">{note ?? meta.description}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {groupFiles.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  expanded={expanded.has(f.id)}
                  onToggle={() => toggle(f.id)}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {reads.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowReads((v) => !v)}
            aria-expanded={showReads}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted hover:text-text"
          >
            <Eye size={13} aria-hidden="true" />
            Files read, not changed ({reads.length})
          </button>
          {showReads && (
            <ul className="mono mt-2 flex flex-col gap-1 text-xs text-text-muted">
              {reads.map((f) => (
                <li key={f.id}>{f.path}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
