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
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: authHeaders(token),
  });
  if (res.status === 404) {
    throw new GithubApiError(
      404,
      `GitHub repo ${owner}/${repo} not found (or private without a token)`,
    );
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
    throw new GithubApiError(
      502,
      `GitHub API error ${res.status} listing Actions runs for ${owner}/${repo}`,
    );
  }
  const body = (await res.json()) as { workflow_runs?: GithubWorkflowRun[] };
  return body.workflow_runs ?? [];
}

// Only these paths are read by packages/parser's discovery, so a sparse
// checkout keeps clones of large repos fast and small.
const DISCOVERY_PATHS = [
  '/.github/',
  '/.agents/skills/',
  '/.claude/skills/',
  '/.vscode/mcp.json',
  '/AGENTS.md',
];
const GIT_TIMEOUT_MS = 120_000;

/**
 * Credentials are injected via git's GIT_CONFIG_* environment mechanism (the
 * same approach actions/checkout uses) rather than the clone URL or argv, so
 * the token never appears in a process listing or in .git/config.
 */
function gitEnv(token: string | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
  }
  return env;
}

/**
 * Shallow, sparse-clones a repo into a fresh temp dir — caller MUST clean it
 * up via cleanupClone. Uses execFile with an explicit argv array (never a
 * shell string), and assertValidSegment restricts owner/repo to GitHub's own
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
  const url = `https://github.com/${owner}/${repo}.git`;
  const options = { env: gitEnv(token), timeout: GIT_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 };
  try {
    await execFileAsync(
      'git',
      ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--quiet', url, dir],
      options,
    );
    await execFileAsync(
      'git',
      ['-C', dir, 'sparse-checkout', 'set', '--no-cone', ...DISCOVERY_PATHS],
      options,
    );
    await execFileAsync('git', ['-C', dir, 'checkout', '--quiet'], options);
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    // Belt and braces: the token isn't in argv, but never let it reach a log
    // line or an API response even if git ever echoes its config.
    const message = err instanceof Error ? err.message : String(err);
    const redacted = token ? message.split(token).join('[REDACTED]') : message;
    throw new Error(`git clone failed for ${owner}/${repo}: ${redacted}`);
  }
  return dir;
}

export async function cleanupClone(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export interface GithubCommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  previous_filename?: string;
}

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

/** Files changed by a single commit (GitHub returns up to 300 per commit). */
export async function fetchCommitFiles(
  owner: string,
  repo: string,
  sha: string,
  token: string | undefined,
): Promise<GithubCommitFile[]> {
  assertValidSegment(owner, 'owner');
  assertValidSegment(repo, 'repo');
  if (!SHA_PATTERN.test(sha)) throw new GithubApiError(400, `invalid commit sha: "${sha}"`);
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new GithubApiError(
      502,
      `GitHub API error ${res.status} fetching commit ${sha.slice(0, 7)}`,
    );
  }
  const body = (await res.json()) as { files?: GithubCommitFile[] };
  return body.files ?? [];
}
