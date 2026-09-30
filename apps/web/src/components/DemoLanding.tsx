import { ExternalLink, GitBranch, Network, PlayCircle, Radar, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: PlayCircle, label: 'Real trace timelines' },
  { icon: ShieldCheck, label: 'Evidence & confidence, never guessed' },
  { icon: GitBranch, label: 'Definition vs. execution' },
  { icon: Network, label: 'Architecture graph' },
];

/** Static-demo-only splash screen shown once per load, before the real dashboard. */
export function DemoLanding({ onEnter }: { onEnter: () => void }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-contrast shadow-lg shadow-accent/20">
        <Radar size={28} strokeWidth={2.25} />
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-text">Agentic Flows</h1>
      <p className="mt-2 max-w-lg text-lg font-medium text-text-muted">
        Observability for agentic software-development workflows
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-status-running/30 bg-status-running-wash px-3 py-1 text-xs font-semibold uppercase tracking-wide text-status-running">
        Static demo — read-only snapshot, no live backend
      </div>
      <p className="mt-6 max-w-xl text-sm leading-relaxed text-text-muted">
        See what autonomous agents actually did during a workflow run — which agents and
        skills participated, what tools were called, what files changed, and what GitHub
        outputs resulted. Every fact is tagged by evidence source and confidence; inference
        is never presented as fact.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-muted"
          >
            <Icon size={13} strokeWidth={2.25} />
            {label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="mt-10 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast shadow-md shadow-accent/20 transition hover:bg-accent-strong"
      >
        Open Dashboard
      </button>
      <a
        href="https://github.com/brianchristopherbrady/glasshouse"
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-1 text-xs text-text-faint underline underline-offset-2 hover:text-text-muted"
      >
        View source on GitHub
        <ExternalLink size={12} strokeWidth={2.25} />
      </a>
    </div>
  );
}
