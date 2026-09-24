import type { LucideIcon } from 'lucide-react';

export function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number | null | undefined;
  icon?: LucideIcon;
}): JSX.Element {
  const display = value === null || value === undefined ? 'Unavailable' : value;
  const isUnavailable = display === 'Unavailable';
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-raised">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {Icon && <Icon size={12} strokeWidth={2.25} />}
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl font-semibold tabular-nums ${isUnavailable ? 'text-text-faint' : 'text-text'}`}
      >
        {display}
      </div>
    </div>
  );
}
