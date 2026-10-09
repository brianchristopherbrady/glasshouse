import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Radar } from 'lucide-react';
import { ApiError, api, setStoredToken } from '../api/client.js';
import { useMe } from '../hooks/useMe.js';

function TokenLogin(): JSX.Element {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setStoredToken(token.trim());
    try {
      await api.getMe();
      // reset (not clear): clear() leaves mounted queries showing the stale 401.
      await queryClient.resetQueries();
    } catch (err) {
      setStoredToken(null);
      setError(
        err instanceof ApiError && err.status === 401
          ? 'That token was not accepted.'
          : 'Could not reach the server.',
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-raised"
        aria-labelledby="signin-title"
      >
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-contrast">
          <Radar size={20} strokeWidth={2.25} />
        </span>
        <h1 id="signin-title" className="text-lg font-semibold text-text">
          Sign in to Agentic Flows
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Paste the API token an administrator issued you. It is kept only in this browser.
        </p>
        <label htmlFor="api-token" className="mt-5 block text-xs font-medium text-text-muted">
          API token
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-accent">
          <KeyRound size={14} className="shrink-0 text-text-faint" aria-hidden="true" />
          <input
            id="api-token"
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-transparent py-2 text-sm text-text outline-hidden placeholder:text-text-faint"
            placeholder="af_…"
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-status-failure">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={checking || !token.trim()}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:bg-accent-strong disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

/** Renders children only once the server accepts the caller (or auth is disabled). */
export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const { data, error, isLoading } = useMe();
  if (isLoading) return <div className="p-6 text-text-muted">Connecting…</div>;
  if (error instanceof ApiError && error.status === 401) return <TokenLogin />;
  if (error || !data) {
    return (
      <div role="alert" className="p-6 text-status-failure">
        Could not reach the Agentic Flows server.
      </div>
    );
  }
  return <>{children}</>;
}
