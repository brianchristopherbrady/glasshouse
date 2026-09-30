import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const GITHUB_API_BASE = 'https://api.github.com';
// Deliberately strict — these values flow into a clone URL and a temp dir
// name, so only GitHub's actual allowed owner/repo character set is accepted.
const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;

export class GithubApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface GithubRepoMeta {
  id: number;
  fullName: string;
  defaultBranch: string;
}

export interface GithubWorkflowRun {
  id: number;
  name: string;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string;
  run_started_at: string | null;
  created_at: string;
  updated_at: string;
}

function assertValidSegment(value: string, label: string): void {
  if (!OWNER_REPO_PATTERN.test(value)) {
    throw new GithubApiError(400, `invalid ${label}: "${value}"`);
  }
}

function authHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agentic-flows',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchRepoMeta(
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<GithubRepoMeta> {
  assertValidSegment(owner, 'owner');
  assertValidSegment(repo, 'repo');
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers: authHeaders(token) });
  if (res.status === 404) {
    throw new GithubApiError(404, `GitHub repo ${owner}/${repo} not found (or private without a token)`);
  }
  if (!res.ok) {
    throw new GithubApiError(502, `GitHub API error ${res.status} fetching ${owner}/${repo}`);
  }
  const body = (await res.json()) as { id: number; full_name: string; default_branch: string };
  return { id: body.id, fullName: body.full_name, defaultBranch: body.default_branch };
}

export async function fetchRecentWorkflowRuns(
  owner: string,
  repo: string,
  token: string | undefined,
  perPage = 30,
): Promise<GithubWorkflowRun[]> {
  assertValidSegment(owner, 'owner');
  assertValidSegment(repo, 'repo');
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) {
    throw new GithubApiError(502, `GitHub API error ${res.status} listing Actions runs for ${owner}/${repo}`);
  }
  const body = (await res.json()) as { workflow_runs?: GithubWorkflowRun[] };
  return body.workflow_runs ?? [];
}

/**
 * Shallow-clones a repo into a fresh temp dir — caller MUST clean it up via
 * cleanupClone. Uses execFile with an explicit argv array (never a shell
 * string), so owner/repo/token can never be interpreted as shell syntax;
 * assertValidSegment additionally restricts owner/repo to GitHub's own
 * allowed character set before they ever reach the clone URL.
 */
export async function cloneRepoShallow(
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<string> {
  assertValidSegment(owner, 'owner');
  assertValidSegment(repo, 'repo');
  const dir = await mkdtemp(path.join(tmpdir(), 'agentic-flows-clone-'));
  const url = token
    ? `https://${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;
  try {
    await execFileAsync('git', ['clone', '--depth', '1', '--quiet', url, dir]);
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    // A failed clone's error can echo the URL (with the token embedded) —
    // never let that reach a log line or an API response.
    const message = err instanceof Error ? err.message : String(err);
    const redacted = token ? message.split(token).join('[REDACTED]') : message;
    throw new Error(`git clone failed for ${owner}/${repo}: ${redacted}`);
  }
  return dir;
}

export async function cleanupClone(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
