import { Fragment } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bookmark, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api/client.js';
import type { FileHistoryEntry } from '../api/types.js';
import { DiffView } from '../components/ChangedFiles.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatRelativeTime } from '../components/Duration.js';

const OPERATION_LABELS: Record<string, string> = {
  created: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  committed: 'Committed',
};

function HistoryEntry({ entry, repoId }: { entry: FileHistoryEntry; repoId: string }): JSX.Element {
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-xs">
        <StatusBadge status={entry.run.status} />
        <Link
          to={`/repos/${repoId}/runs/${entry.run.id}?tab=files`}
          className="min-w-0 font-medium text-text underline-offset-2 hover:text-accent hover:underline"
        >
          {entry.run.workflowName}
        </Link>
        {entry.run.savedAt && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-accent-wash px-1.5 py-0.5 text-[11px] font-medium text-accent">
            <Bookmark size={11} aria-hidden="true" />
            {entry.run.savedLabel ?? 'Saved'}
          </span>
        )}
        <span className="text-text-muted">{formatRelativeTime(entry.run.startTime)}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-text-muted">
            {OPERATION_LABELS[entry.operation] ?? entry.operation}
          </span>
          <span className="mono tabular-nums">
            {entry.additions != null && (
              <span className="text-status-success">+{entry.additions}</span>
            )}{' '}
            {entry.deletions != null && (
              <span className="text-status-failure">−{entry.deletions}</span>
            )}
          </span>
          {entry.actorId && (
            <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-muted">
              by {entry.actorId}
            </span>
          )}
        </span>
      </div>
      {entry.diff ? (
        <DiffView diff={entry.diff} />
      ) : (
        <p className="border-t border-border bg-surface-sunken px-3 py-2 text-xs text-text-muted">
          No diff was recorded for this change.
        </p>
      )}
    </li>
  );
}

function FileHistory({ repoId, path }: { repoId: string; path: string }): JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['file-history', repoId, path],
    queryFn: () => api.getFileHistory(repoId, path),
  });
  if (isLoading) return <p className="text-xs text-text-muted">Loading changes…</p>;
  if (error || !data) {
    return <p className="text-xs text-status-failure">Could not load the changes to this file.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">
        {data.length} recorded {data.length === 1 ? 'change' : 'changes'}, newest run first.
      </p>
      <ul className="flex flex-col gap-3">
        {data.map((entry) => (
          <HistoryEntry key={entry.id} entry={entry} repoId={repoId} />
        ))}
      </ul>
    </div>
  );
}

export function FilesPage(): JSX.Element {
  const { repoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const openPath = searchParams.get('path');
  const { data: hotspots, isLoading } = useQuery({
    queryKey: ['file-hotspots', repoId],
    queryFn: () => api.listFileHotspots(repoId!),
    enabled: !!repoId,
  });

  function toggle(path: string): void {
    const next = new URLSearchParams(searchParams);
    if (openPath === path) next.delete('path');
    else next.set('path', path);
    setSearchParams(next, { replace: true });
  }

  if (isLoading) return <div className="text-text-muted">Loading file activity…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Files</h1>
      <p className="text-xs text-text-muted">
        Aggregated agent activity across runs — what code do autonomous workflows keep changing?
        Select a file to see every recorded change to it.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised shadow-raised">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Path</th>
              <th className="px-4 py-2.5 font-medium">Runs touching</th>
              <th className="px-4 py-2.5 font-medium">Workflows</th>
              <th className="px-4 py-2.5 font-medium">Total ops</th>
              <th className="px-4 py-2.5 font-medium">Failure correlation</th>
            </tr>
          </thead>
          <tbody>
            {hotspots?.map((h) => {
              const open = openPath === h.path;
              const detailId = `file-history-${h.path.replace(/[^\w-]/g, '-')}`;
              return (
                <Fragment key={h.path}>
                  <tr
                    className={clsx(
                      'border-t border-border transition-colors first:border-t-0 hover:bg-surface-sunken',
                      open && 'bg-surface-sunken',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(h.path)}
                        aria-expanded={open}
                        aria-controls={detailId}
                        className="mono flex items-center gap-1.5 text-left text-text hover:text-accent"
                      >
                        {open ? (
                          <ChevronDown
                            size={14}
                            className="shrink-0 text-text-muted"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            size={14}
                            className="shrink-0 text-text-muted"
                            aria-hidden="true"
                          />
                        )}
                        <span className="break-all">{h.path}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-text">{h.runCount}</td>
                    <td className="px-4 py-2.5 text-text-muted">{h.workflows.join(', ')}</td>
                    <td className="px-4 py-2.5 text-text">{h.totalOps}</td>
                    <td className="px-4 py-2.5">
                      {h.failureCount > 0 ? (
                        <span className="rounded-full bg-status-failure-wash px-2 py-0.5 text-xs font-semibold text-status-failure">
                          {h.failureCount} failing run(s)
                        </span>
                      ) : (
                        <span className="text-text-muted">None observed</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr id={detailId} className="border-t border-border bg-surface-sunken">
                      <td colSpan={5} className="px-4 py-3">
                        {/* w-0 + min-w-full: long diff lines scroll instead of widening the table. */}
                        <div className="w-0 min-w-full">
                          <FileHistory repoId={repoId!} path={h.path} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {hotspots?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
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
