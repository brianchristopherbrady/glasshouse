import clsx from 'clsx';

const LABELS: Record<string, string> = {
  success: 'Success',
  failure: 'Failure',
  running: 'Running',
  pending: 'Pending',
  unknown: 'Unknown',
};

const STYLES: Record<string, string> = {
  success: 'bg-status-success-wash text-status-success',
  failure: 'bg-status-failure-wash text-status-failure',
  running: 'bg-status-running-wash text-status-running',
  pending: 'bg-status-pending-wash text-status-pending',
  unknown: 'bg-status-unknown-wash text-status-unknown',
};

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const normalized = LABELS[status] ? status : 'unknown';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        STYLES[normalized],
      )}
    >
      <span className={clsx('status-dot', `status-dot--${normalized}`)} />
      {LABELS[normalized]}
    </span>
  );
}
