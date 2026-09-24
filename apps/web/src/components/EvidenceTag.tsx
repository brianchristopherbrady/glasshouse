import clsx from 'clsx';
import { CircleCheck, CircleHelp, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

const CONFIDENCE_STYLES: Record<string, string> = {
  observed: 'bg-evidence-observed-wash text-evidence-observed',
  strong: 'bg-evidence-strong-wash text-evidence-strong',
  inferred: 'bg-evidence-inferred-wash text-evidence-inferred',
  unknown: 'bg-evidence-unknown-wash text-evidence-unknown',
};

const CONFIDENCE_ICON: Record<string, LucideIcon> = {
  observed: CircleCheck,
  strong: ShieldCheck,
  inferred: Sparkles,
  unknown: CircleHelp,
};

/**
 * Renders a fact's evidence provenance — the product's core trust device.
 * Never presents inference as fact; always visible, never hidden behind a
 * hover-only tooltip (title attribute is supplementary, not the only cue).
 */
export function EvidenceTag({
  source,
  confidence,
}: {
  source: string;
  confidence: string;
}): JSX.Element {
  const normalized = CONFIDENCE_STYLES[confidence] ? confidence : 'unknown';
  const Icon = CONFIDENCE_ICON[normalized] ?? CircleHelp;
  return (
    <span
      className={clsx(
        'mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        CONFIDENCE_STYLES[normalized],
      )}
      title={`Source: ${source}`}
    >
      <Icon size={11} strokeWidth={2.5} />
      {confidence} · {source}
    </span>
  );
}
