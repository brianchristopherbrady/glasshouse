import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppJwt, createGithubTokenResolver, loadGithubAppConfig } from '../src/githubAuth.js';
import { buildContentSecurityPolicy, inlineScriptHashes } from '../src/securityHeaders.js';
import { verifyGithubSignature } from '../src/routes/webhooks.js';
import { createHmac } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

describe('GitHub App JWT', () => {
  it('produces an RS256 JWT verifiable with the app public key', () => {
    const jwt = createAppJwt({ appId: '12345', privateKey }, Date.UTC(2026, 9, 8));
    const [header, payload, signature] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims.iss).toBe('12345');
    expect(claims.exp - claims.iat).toBe(600);
    const ok = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
    expect(ok).toBe(true);
  });

  it('loads a private key from an env var with escaped newlines', () => {
    const config = loadGithubAppConfig({
      AGENTIC_FLOWS_GITHUB_APP_ID: '1',
      AGENTIC_FLOWS_GITHUB_APP_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
    });
    expect(config?.appId).toBe('1');
  });

  it('returns null (PAT mode) when App credentials are incomplete', () => {
    expect(loadGithubAppConfig({ AGENTIC_FLOWS_GITHUB_APP_ID: '1' })).toBeNull();
  });
});

describe('createGithubTokenResolver', () => {
  it('falls back to the PAT when no App is configured', async () => {
    const resolve = createGithubTokenResolver(null, 'ghp_pat');
    expect(await resolve('acme', 'payments')).toBe('ghp_pat');
  });

  it('exchanges the App JWT for a cached installation token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 77 }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'ghs_install',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          }),
          {
            status: 201,
          },
        ),
      );
    const resolve = createGithubTokenResolver({ appId: '9', privateKey }, undefined, fetchImpl);
    expect(await resolve('Acme', 'Payments')).toBe('ghs_install');
    expect(await resolve('acme', 'payments')).toBe('ghs_install');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://api.github.com/repos/Acme/Payments/installation',
    );
    expect(fetchImpl.mock.calls[1]![0]).toBe(
      'https://api.github.com/app/installations/77/access_tokens',
    );
    expect(fetchImpl.mock.calls[1]![1].headers.Authorization).toMatch(/^Bearer ey/);
  });

  it('reports an uninstalled App as a 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const resolve = createGithubTokenResolver({ appId: '9', privateKey }, undefined, fetchImpl);
    await expect(resolve('acme', 'payments')).rejects.toMatchObject({ status: 404 });
  });
});

describe('verifyGithubSignature', () => {
  const body = Buffer.from('{"a":1}');
  const good = `sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`;

  it('accepts the exact HMAC and rejects anything else', () => {
    expect(verifyGithubSignature('s3cret', body, good)).toBe(true);
    expect(verifyGithubSignature('other', body, good)).toBe(false);
    expect(verifyGithubSignature('s3cret', Buffer.from('{"a":2}'), good)).toBe(false);
    expect(verifyGithubSignature('s3cret', body, undefined)).toBe(false);
    expect(verifyGithubSignature('s3cret', body, 'sha1=abc')).toBe(false);
  });
});

describe('content security policy', () => {
  it('hashes inline scripts (but not external ones) from the built index.html', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'csp-test-'));
    try {
      const file = path.join(dir, 'index.html');
      writeFileSync(
        file,
        '<html><head><script>document.documentElement.dataset.x = "1";</script>' +
          '<script type="module" src="/assets/app.js"></script></head></html>',
      );
      const hashes = inlineScriptHashes(file);
      expect(hashes).toHaveLength(1);
      expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);
      const csp = buildContentSecurityPolicy(hashes);
      expect(csp).toContain(`script-src 'self' ${hashes[0]}`);
      expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns no hashes when the web app is not built', () => {
    expect(inlineScriptHashes(path.join(tmpdir(), 'missing', 'index.html'))).toEqual([]);
  });

  it('hashes CRLF files the way browsers do (newlines normalized to LF)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'csp-test-'));
    try {
      const lf = path.join(dir, 'lf.html');
      const crlf = path.join(dir, 'crlf.html');
      writeFileSync(lf, '<script>\n  var a = 1;\n</script>');
      writeFileSync(crlf, '<script>\r\n  var a = 1;\r\n</script>');
      expect(inlineScriptHashes(crlf)).toEqual(inlineScriptHashes(lf));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
