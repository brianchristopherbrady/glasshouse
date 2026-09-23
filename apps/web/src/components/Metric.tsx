export function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): JSX.Element {
  const display = value === null || value === undefined ? 'Unavailable' : value;
  const isUnavailable = display === 'Unavailable';
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${isUnavailable ? 'text-text-muted' : 'text-text'}`}>
        {display}
      </div>
    </div>
  );
}
