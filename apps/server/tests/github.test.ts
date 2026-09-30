import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GithubApiError,
  cloneRepoShallow,
  fetchRecentWorkflowRuns,
  fetchRepoMeta,
} from '../src/github.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRepoMeta', () => {
  it('maps a successful response to repo metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, full_name: 'acme/payments', default_branch: 'main' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const meta = await fetchRepoMeta('acme', 'payments', undefined);
    expect(meta).toEqual({ id: 42, fullName: 'acme/payments', defaultBranch: 'main' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.github.com/repos/acme/payments');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('sends an Authorization header when a token is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, full_name: 'a/b', default_branch: 'main' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchRepoMeta('a', 'b', 'my-token');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe('Bearer my-token');
  });

  it('throws a 404 GithubApiError for a missing/private repo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchRepoMeta('acme', 'nope', undefined)).rejects.toMatchObject({
      status: 404,
      constructor: GithubApiError,
    });
  });

  it('throws a 502 GithubApiError for any other non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(fetchRepoMeta('acme', 'payments', undefined)).rejects.toMatchObject({ status: 502 });
  });

  it('rejects an owner/repo containing invalid characters before ever calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchRepoMeta('../evil', 'x', undefined)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchRecentWorkflowRuns', () => {
  it('returns the workflow_runs array from a successful response', async () => {
    const runs = [{ id: 1, name: 'CI', path: '.github/workflows/ci.yml' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 })));
    const result = await fetchRecentWorkflowRuns('acme', 'payments', undefined);
    expect(result).toEqual(runs);
  });

  it('throws a 502 GithubApiError on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(fetchRecentWorkflowRuns('acme', 'payments', undefined)).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe('cloneRepoShallow', () => {
  it('rejects a path-traversal-shaped owner without spawning git', async () => {
    await expect(cloneRepoShallow('../../etc', 'passwd', undefined)).rejects.toThrow(/invalid owner/);
  });
});
