import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Github, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { ApiError, STATIC_DEMO, api } from '../api/client.js';
import type { CreatedApiToken, Role } from '../api/types.js';
import { useMe } from '../hooks/useMe.js';

const ROLE_HELP: Record<Role, string> = {
  admin: 'Full access, including tokens and syncing',
  viewer: 'Read-only dashboard access',
  ingest: 'Can only post telemetry events',
};

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Request failed.';
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Github;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg border border-border bg-surface-raised p-4 shadow-raised sm:p-5"
      aria-label={title}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <Icon size={15} className="text-accent" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const inputClass =
  'rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-hidden';
const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-contrast hover:bg-accent-strong disabled:opacity-60';

function GithubSection({ repoId }: { repoId: string | undefined }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState('');

  const connect = useMutation({
    mutationFn: () => {
      const [owner = '', repo = ''] = slug.trim().split('/');
      return api.connectGithubRepository(owner, repo);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      navigate(`/repos/${result.repository.id}`);
    },
  });
  const syncRuns = useMutation({
    mutationFn: () => api.syncGithubRuns(repoId!),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    connect.mutate();
  }

  return (
    <Card title="GitHub" icon={Github}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Connect a repository
          <input
            className={`${inputClass} w-72`}
            placeholder="owner/repo"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+"
            required
          />
        </label>
        <button type="submit" className={buttonClass} disabled={connect.isPending}>
          {connect.isPending ? 'Connecting…' : 'Connect & discover'}
        </button>
      </form>
      {connect.isError && (
        <p className="mt-2 text-sm text-status-failure">{errorText(connect.error)}</p>
      )}

      {repoId && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            className={buttonClass}
            onClick={() => syncRuns.mutate()}
            disabled={syncRuns.isPending}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={syncRuns.isPending ? 'animate-spin' : undefined}
            />
            Sync GitHub Actions runs
          </button>
          <span className="text-xs text-text-muted" role="status">
            {syncRuns.isSuccess &&
              `${syncRuns.data.created} new, ${syncRuns.data.updated} updated runs · ${syncRuns.data.changedFiles} changed files imported`}
            {syncRuns.isError && (
              <span className="text-status-failure">{errorText(syncRuns.error)}</span>
            )}
          </span>
        </div>
      )}
      <p className="mt-2 text-xs text-text-faint">
        Configure a GitHub webhook (event: Workflow runs, content type: application/json) pointing
        at /api/webhooks/github to keep runs current automatically.
      </p>
    </Card>
  );
}

function TokensSection(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: tokens } = useQuery({ queryKey: ['tokens'], queryFn: api.listTokens });
  const { data: repositories } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.listRepositories,
  });
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [repositoryId, setRepositoryId] = useState('');
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.createToken({
        name,
        role,
        repositoryId: role === 'ingest' && repositoryId ? repositoryId : null,
      }),
    onSuccess: async (token) => {
      setCreated(token);
      setCopied(false);
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tokens'] }),
  });
  const repoName = (id: string | null) =>
    repositories?.find((r) => r.id === id)?.fullName ?? 'all repositories';

  return (
    <Card title="API tokens" icon={KeyRound}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Name
          <input
            className={`${inputClass} w-48`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Role
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
              <option key={r} value={r}>
                {r} — {ROLE_HELP[r]}
              </option>
            ))}
          </select>
        </label>
        {role === 'ingest' && (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Limit to repository
            <select
              className={inputClass}
              value={repositoryId}
              onChange={(e) => setRepositoryId(e.target.value)}
            >
              <option value="">All repositories</option>
              {repositories?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className={buttonClass} disabled={create.isPending}>
          Create token
        </button>
      </form>
      {create.isError && (
        <p className="mt-2 text-sm text-status-failure">{errorText(create.error)}</p>
      )}

      {created && (
        <div
          role="status"
          className="mt-3 rounded-md border border-status-running/30 bg-status-running-wash p-3 text-xs"
        >
          <p className="font-semibold text-status-running">
            Copy this token now — it will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code
              className="mono flex-1 break-all rounded-sm bg-surface px-2 py-1 text-text"
              data-testid="new-token"
            >
              {created.token}
            </code>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-muted hover:text-text"
              onClick={async () => {
                await navigator.clipboard.writeText(created.token);
                setCopied(true);
              }}
            >
              <Copy size={12} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <table className="mt-4 w-full text-left text-xs">
        <thead className="text-[11px] uppercase tracking-wide text-text-muted">
          <tr>
            <th className="py-1.5 font-medium">Name</th>
            <th className="py-1.5 font-medium">Role</th>
            <th className="py-1.5 font-medium">Scope</th>
            <th className="py-1.5 font-medium">Last used</th>
            <th className="py-1.5 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens?.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <td className="py-2 text-text">{t.name}</td>
              <td className="mono py-2 text-text-muted">{t.role}</td>
              <td className="py-2 text-text-muted">{repoName(t.repositoryId)}</td>
              <td className="py-2 text-text-muted">
                {t.revokedAt
                  ? 'Revoked'
                  : t.lastUsedAt
                    ? new Date(t.lastUsedAt).toLocaleString()
                    : 'Never'}
              </td>
              <td className="py-2 text-right">
                {!t.revokedAt && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(t.id)}
                    className="inline-flex items-center gap-1 text-status-failure hover:underline"
                    aria-label={`Revoke token ${t.name}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
          {tokens?.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-text-muted">
                No tokens yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

export function SettingsPage(): JSX.Element {
  const { repoId } = useParams();
  const { data: me } = useMe();
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-text">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as <span className="text-text">{me?.name}</span> ({me?.role}).
          {me && !me.authEnabled && ' Authentication is disabled on this server.'}
        </p>
      </div>
      {STATIC_DEMO ? (
        <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
          Settings require a live server and are unavailable in this static demo.
        </p>
      ) : me?.role === 'admin' ? (
        <>
          <GithubSection repoId={repoId} />
          <TokensSection />
        </>
      ) : (
        <p className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-muted">
          Your role is read-only. Ask an administrator to connect repositories or issue tokens.
        </p>
      )}
    </div>
  );
}
