import clsx from 'clsx';

const CONFIDENCE_STYLES: Record<string, string> = {
  observed: 'text-status-success border-status-success/40',
  strong: 'text-accent border-accent/40',
  inferred: 'text-status-running border-status-running/40',
  unknown: 'text-text-muted border-border',
};

/**
 * Renders a fact's evidence provenance. Never presents inference as fact —
 * always visible, never hidden behind a hover-only tooltip.
 */
export function EvidenceTag({
  source,
  confidence,
}: {
  source: string;
  confidence: string;
}): JSX.Element {
  return (
    <span
      className={clsx(
        'mono inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]',
        CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.unknown,
      )}
      title={`Source: ${source}`}
    >
      {confidence} · {source}
    </span>
  );
}
