import clsx from 'clsx';

type TriState = 'true' | 'false' | 'unknown';

const STYLES: Record<TriState, string> = {
  true: 'bg-status-success-wash text-status-success',
  false: 'bg-surface-sunken text-text-muted',
  unknown: 'bg-evidence-unknown-wash text-evidence-unknown',
};

const LABELS: Record<TriState, string> = {
  true: 'Yes',
  false: 'No',
  unknown: 'Unknown',
};

/**
 * A skill-usage fact is never collapsed into a boolean — this makes the
 * three real states (yes / no / unknown) visually distinct, not a plain
 * "Yes"/"No" pair that quietly hides "unknown" as a lesser gray "No".
 */
export function TriStatePill({ value, label }: { value: TriState; label?: string }): JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold',
        STYLES[value],
      )}
    >
      {label ? `${label}: ${LABELS[value]}` : LABELS[value]}
    </span>
  );
}
