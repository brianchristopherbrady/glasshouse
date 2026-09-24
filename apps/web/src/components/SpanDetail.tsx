import type { TraceSpanNode } from '../api/types.js';
import { StatusBadge } from './StatusBadge.js';
import { EvidenceTag } from './EvidenceTag.js';
import { Duration } from './Duration.js';

export function SpanDetail({ span }: { span: TraceSpanNode | null }): JSX.Element {
  if (!span) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-raised p-4 text-sm text-text-muted shadow-raised xl:sticky xl:top-16">
        Select a span in the trace to inspect its attributes.
      </div>
    );
  }
  const attrs = span.attributes && typeof span.attributes === 'object' ? span.attributes : {};
  const hasAttrs = Object.keys(attrs as Record<string, unknown>).length > 0;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm shadow-raised xl:sticky xl:top-16">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-text">{span.name}</h3>
        <StatusBadge status={span.status} />
      </div>
      <div className="mono mt-1 text-xs text-text-muted">{span.type}</div>
      <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
        <dt className="text-text-muted">Duration</dt>
        <dd className="mono text-right text-text">
          <Duration ms={span.durationMs} />
        </dd>
        <dt className="text-text-muted">Start</dt>
        <dd className="mono text-right text-text">
          {new Date(span.startTime).toLocaleTimeString()}
        </dd>
        <dt className="text-text-muted">End</dt>
        <dd className="mono text-right text-text">
          {span.endTime ? new Date(span.endTime).toLocaleTimeString() : 'Unavailable'}
        </dd>
      </dl>
      <div className="mt-3 border-t border-border pt-3">
        <EvidenceTag source={span.source} confidence={span.confidence} />
      </div>
      {hasAttrs && (
        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Attributes
          </div>
          <pre className="mono mt-1.5 max-h-48 overflow-auto rounded bg-surface-sunken p-2 text-[11px] text-text">
            {JSON.stringify(attrs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
