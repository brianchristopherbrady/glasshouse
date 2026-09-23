import clsx from 'clsx';

const LABELS: Record<string, string> = {
  success: 'Success',
  failure: 'Failure',
  running: 'Running',
  pending: 'Pending',
  unknown: 'Unknown',
};

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const normalized = LABELS[status] ? status : 'unknown';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-text">
      <span className={clsx('status-dot', `status-dot--${normalized}`)} />
      {LABELS[normalized]}
    </span>
  );
}
