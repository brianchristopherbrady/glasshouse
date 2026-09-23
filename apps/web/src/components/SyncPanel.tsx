import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, ApiError } from '../api/client.js';
import type { SyncResult } from '../api/types.js';

/**
 * Triggers static-definition discovery against a repository checkout
 * already present on disk. This is NOT the GitHub-API live-sync flow
 * (cloning a remote repo) — that's a later phase; this operates on a path
 * the server process can already read.
 */
export function SyncPanel({
  repoId,
  onSynced,
}: {
  repoId: string;
  onSynced: () => void;
}): JSX.Element {
  const [checkoutDir, setCheckoutDir] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.syncRepository(repoId, checkoutDir),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      onSynced();
    },
    onError: (err: unknown) => {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Sync failed.');
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={checkoutDir}
          onChange={(e) => setCheckoutDir(e.target.value)}
          placeholder="Local checkout path to sync from"
          className="w-72 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-text"
          aria-label="Repository checkout path"
        />
        <button
          type="button"
          disabled={!checkoutDir || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-sunken disabled:opacity-50"
        >
          <RefreshCw size={13} className={mutation.isPending ? 'animate-spin' : ''} />
          Sync from disk
        </button>
      </div>
      {result && (
        <div className="text-xs text-status-success">
          Synced: {result.workflows} workflows, {result.agents} agents, {result.skills} skills,{' '}
          {result.relationships} relationships.
        </div>
      )}
      {error && <div className="text-xs text-status-failure">{error}</div>}
    </div>
  );
}
