import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GithubApiError } from './github.js';

const GITHUB_API_BASE = 'https://api.github.com';
// Refresh installation tokens this long before GitHub's own expiry.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

export interface GithubAppConfig {
  appId: string;
  privateKey: KeyObject;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** App-level JWT (RS256), valid for at most 10 minutes per GitHub's rules. */
export function createAppJwt(config: GithubAppConfig, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat is backdated 60s to tolerate clock drift, as GitHub recommends.
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: config.appId }));
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), config.privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Reads GitHub App credentials from env; null means "use a PAT (or nothing)". */
export function loadGithubAppConfig(env: NodeJS.ProcessEnv = process.env): GithubAppConfig | null {
  const appId = env.GLASSHOUSE_GITHUB_APP_ID;
  const inlineKey = env.GLASSHOUSE_GITHUB_APP_PRIVATE_KEY;
  const keyPath = env.GLASSHOUSE_GITHUB_APP_PRIVATE_KEY_PATH;
  if (!appId || (!inlineKey && !keyPath)) return null;
  // Env-var PEMs are commonly stored with literal "\n" sequences.
  const pem = inlineKey ? inlineKey.replace(/\\n/g, '\n') : readFileSync(keyPath!, 'utf8');
  return { appId, privateKey: createPrivateKey(pem) };
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

export function createGithubTokenResolver(
  config: GithubAppConfig | null,
  pat: string | undefined,
  fetchImpl: typeof fetch = fetch,
) {
  const installationByRepo = new Map<string, number>();
  const tokenByInstallation = new Map<number, CachedToken>();

  async function appRequest<T>(method: string, path: string): Promise<T> {
    const res = await fetchImpl(`${GITHUB_API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'glasshouse',
        Authorization: `Bearer ${createAppJwt(config!)}`,
      },
    });
    if (res.status === 404) {
      throw new GithubApiError(
        404,
        `GitHub App is not installed on ${path.split('/').slice(2, 4).join('/')}`,
      );
    }
    if (!res.ok)
      throw new GithubApiError(502, `GitHub App API error ${res.status} (${method} ${path})`);
    return (await res.json()) as T;
  }

  /** Token for API/clone calls on owner/repo: App installation token, else PAT, else none. */
  return async function resolveToken(owner: string, repo: string): Promise<string | undefined> {
    if (!config) return pat;
    const key = `${owner}/${repo}`.toLowerCase();
    let installationId = installationByRepo.get(key);
    if (installationId === undefined) {
      const installation = await appRequest<{ id: number }>(
        'GET',
        `/repos/${owner}/${repo}/installation`,
      );
      installationId = installation.id;
      installationByRepo.set(key, installationId);
    }
    const cached = tokenByInstallation.get(installationId);
    if (cached && cached.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > Date.now()) return cached.token;

    const created = await appRequest<{ token: string; expires_at: string }>(
      'POST',
      `/app/installations/${installationId}/access_tokens`,
    );
    tokenByInstallation.set(installationId, {
      token: created.token,
      expiresAtMs: new Date(created.expires_at).getTime(),
    });
    return created.token;
  };
}

export type GithubTokenResolver = ReturnType<typeof createGithubTokenResolver>;
