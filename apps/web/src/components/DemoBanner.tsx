import { ExternalLink } from 'lucide-react';

const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';

/** Only rendered in the GitHub Pages static-snapshot build (VITE_STATIC_DEMO=true). */
export function DemoBanner(): JSX.Element | null {
  if (!STATIC_DEMO) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-status-running/30 bg-status-running-wash px-4 py-2 text-center text-[13px] font-medium text-status-running">
      <span aria-hidden="true">●</span>
      <span>
        Static demo — a read-only snapshot with fixed sample data. No live backend, no sync,
        nothing you do here is saved.
      </span>
      <a
        href="https://github.com/brianchristopherbrady/glasshouse"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-text"
      >
        View source
        <ExternalLink size={12} strokeWidth={2.25} />
      </a>
    </div>
  );
}
