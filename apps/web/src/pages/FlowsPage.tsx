import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import type { PromptDefinition, WorkflowDefinition } from '../api/types.js';
import { SyncPanel } from '../components/SyncPanel.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatRelativeTime } from '../components/Duration.js';

const CARD = 'flex flex-col rounded-lg border border-border bg-surface-raised p-4 shadow-raised';
const CHIP = 'mono shrink-0 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-xs text-text-muted';

function Section({
  title,
  note,
  empty,
  children,
}: {
  title: string;
  note: ReactNode;
  empty: ReactNode | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="mt-0.5 text-xs text-text-muted">{note}</p>
      </div>
      {empty ? (
        <div className="text-sm text-text-muted">{empty}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

function WorkflowCard({ wf }: { wf: WorkflowDefinition }): JSX.Element {
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-text">{wf.name}</h3>
        {wf.engine && <span className={CHIP}>{wf.engine}</span>}
      </div>
      <p className="mono mt-1 text-xs text-text-muted">{wf.path}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {wf.triggers.map((t) => (
          <span
            key={t}
            className="rounded-full bg-accent-wash px-2 py-0.5 text-xs font-medium text-accent"
          >
            {t}
          </span>
        ))}
      </div>
      {wf.safeOutputs && wf.safeOutputs.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Safe outputs
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {wf.safeOutputs.map((o) => (
              <span key={o} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}
      {wf.permissions && (
        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Permissions
          </div>
          <div className="mono mt-1 text-xs text-text">
            {Object.entries(wf.permissions)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')}
          </div>
        </div>
      )}
      <div className="mt-auto pt-3 text-xs text-text-muted">
        {wf.compiledWorkflow ? `Compiled: ${wf.compiledWorkflow.path}` : 'Not compiled'}
      </div>
    </div>
  );
}

function PromptCard({ prompt, repoId }: { prompt: PromptDefinition; repoId: string }): JSX.Element {
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="mono font-medium text-text">/{prompt.command}</h3>
        {prompt.agent && <span className={CHIP}>agent: {prompt.agent}</span>}
      </div>
      <p className="mono mt-1 text-xs text-text-muted">{prompt.path}</p>
      {prompt.description && <p className="mt-3 text-sm text-text">{prompt.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs text-text-muted">
        {prompt.lastRun ? (
          <>
            <Link
              to={`/repos/${repoId}/runs?prompt=${prompt.id}`}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              {prompt.runCount} {prompt.runCount === 1 ? 'run' : 'runs'}
            </Link>
            <span aria-hidden="true">·</span>
            <span>last {formatRelativeTime(prompt.lastRun.startTime)}</span>
            <StatusBadge status={prompt.lastRun.status} />
          </>
        ) : (
          'No runs yet'
        )}
      </div>
    </div>
  );
}

export function FlowsPage(): JSX.Element {
  const { repoId } = useParams();
  const queryClient = useQueryClient();
  const { data: workflows, isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflows', repoId],
    queryFn: () => api.listWorkflows(repoId!),
    enabled: !!repoId,
  });
  const { data: prompts, isLoading: loadingPrompts } = useQuery({
    queryKey: ['prompts', repoId],
    queryFn: () => api.listPrompts(repoId!),
    enabled: !!repoId,
    // Run counts grow while local agent sessions are recorded.
    refetchInterval: 5000,
  });

  if (loadingWorkflows || loadingPrompts) {
    return <div className="text-text-muted">Loading flows…</div>;
  }

  const workflowSection = (
    <Section
      key="workflows"
      title="Agentic workflows"
      note={
        <>
          <span className="mono">.github/workflows/*.md</span>, run by GitHub Actions.
        </>
      }
      empty={workflows?.length ? null : 'No agentic workflows in this repository.'}
    >
      {workflows?.map((wf) => <WorkflowCard key={wf.id} wf={wf} />)}
    </Section>
  );
  const promptSection = (
    <Section
      key="prompts"
      title="Prompt files"
      note={
        <>
          <span className="mono">.github/prompts/*.prompt.md</span>, run as slash commands in
          Copilot Chat. A recorded chat session is linked to the prompt file its first message
          invoked.
        </>
      }
      empty={prompts?.length ? null : 'No prompt files in this repository.'}
    >
      {prompts?.map((p) => <PromptCard key={p.id} prompt={p} repoId={repoId!} />)}
    </Section>
  );
  // Lead with whichever kind this repository actually uses.
  const promptsFirst = !workflows?.length && !!prompts?.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Flows</h1>
        <SyncPanel
          repoId={repoId!}
          onSynced={() => {
            void queryClient.invalidateQueries({ queryKey: ['workflows', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['prompts', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['relationships', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['agents', repoId] });
            void queryClient.invalidateQueries({ queryKey: ['skills', repoId] });
          }}
        />
      </div>
      {promptsFirst ? [promptSection, workflowSection] : [workflowSection, promptSection]}
    </div>
  );
}
