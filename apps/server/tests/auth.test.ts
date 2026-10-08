import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import {
  createAuthHook,
  generateToken,
  hashToken,
  requiredRoles,
  type StoredToken,
} from '../src/auth.js';

const BOOTSTRAP = 'bootstrap-secret';

function storedToken(overrides: Partial<StoredToken> = {}): StoredToken {
  return {
    id: 'tok_1',
    name: 'alice',
    role: 'viewer',
    repositoryId: null,
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

async function buildApp(
  tokens: Record<string, StoredToken> = {},
  bootstrapToken: string | undefined = BOOTSTRAP,
) {
  const used: string[] = [];
  const app = Fastify();
  app.addHook(
    'onRequest',
    createAuthHook({
      bootstrapToken,
      findTokenByHash: async (hash) =>
        Object.entries(tokens).find(([plain]) => hashToken(plain) === hash)?.[1] ?? null,
      markUsed: async (id) => {
        used.push(id);
      },
    }),
  );
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/repositories', async (req) => ({ principal: req.principal }));
  app.post('/api/repositories/github', async () => ({ ok: true }));
  app.post('/api/telemetry/events', async () => ({ ok: true }));
  app.get('/', async () => 'index.html');
  return { app, used };
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('requiredRoles', () => {
  it('keeps health/readiness, the static app and the signed webhook public', () => {
    expect(requiredRoles('GET', '/api/health')).toBe('public');
    expect(requiredRoles('GET', '/api/ready')).toBe('public');
    expect(requiredRoles('GET', '/repos/abc/runs')).toBe('public');
    expect(requiredRoles('POST', '/api/webhooks/github')).toBe('public');
  });

  it('lets viewers read, ingest tokens post telemetry, and only admins mutate', () => {
    expect(requiredRoles('GET', '/api/runs/1/trace?x=1')).toEqual(['admin', 'viewer']);
    expect(requiredRoles('POST', '/api/telemetry/batch')).toEqual(['admin', 'ingest']);
    expect(requiredRoles('POST', '/api/repositories/github')).toEqual(['admin']);
    expect(requiredRoles('DELETE', '/api/tokens/1')).toEqual(['admin']);
  });
});

describe('createAuthHook', () => {
  it('treats every caller as an anonymous admin when no bootstrap token is configured', async () => {
    // '' rather than undefined: undefined would trigger the helper's default token.
    const { app } = await buildApp({}, '');
    const res = await app.inject({ method: 'POST', url: '/api/repositories/github' });
    expect(res.statusCode).toBe(200);
  });

  it('always allows public routes without a token', async () => {
    const { app } = await buildApp();
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(200);
  });

  it('rejects a missing or wrong token with 401', async () => {
    const { app } = await buildApp();
    expect((await app.inject({ method: 'GET', url: '/api/repositories' })).statusCode).toBe(401);
    const wrong = await app.inject({
      method: 'GET',
      url: '/api/repositories',
      headers: bearer('nope'),
    });
    expect(wrong.statusCode).toBe(401);
  });

  it('accepts the bootstrap token as an admin', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/repositories/github',
      headers: bearer(BOOTSTRAP),
    });
    expect(res.statusCode).toBe(200);
  });

  it('lets a viewer token read but not mutate', async () => {
    const viewer = generateToken();
    const { app, used } = await buildApp({ [viewer]: storedToken() });
    const read = await app.inject({
      method: 'GET',
      url: '/api/repositories',
      headers: bearer(viewer),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().principal).toMatchObject({ kind: 'token', name: 'alice', role: 'viewer' });
    expect(used).toEqual(['tok_1']);
    const write = await app.inject({
      method: 'POST',
      url: '/api/repositories/github',
      headers: bearer(viewer),
    });
    expect(write.statusCode).toBe(403);
  });

  it('lets an ingest token post telemetry but not read', async () => {
    const ingest = generateToken();
    const { app } = await buildApp({ [ingest]: storedToken({ role: 'ingest' }) });
    expect(
      (await app.inject({ method: 'POST', url: '/api/telemetry/events', headers: bearer(ingest) }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/repositories', headers: bearer(ingest) }))
        .statusCode,
    ).toBe(403);
  });

  it('rejects a revoked token', async () => {
    const revoked = generateToken();
    const { app } = await buildApp({ [revoked]: storedToken({ revokedAt: new Date() }) });
    const res = await app.inject({
      method: 'GET',
      url: '/api/repositories',
      headers: bearer(revoked),
    });
    expect(res.statusCode).toBe(401);
  });

  it('only stores a hash: the same plaintext always hashes the same, different plaintexts differ', () => {
    const a = generateToken();
    expect(a.startsWith('af_')).toBe(true);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(generateToken()));
    expect(hashToken(a)).not.toContain(a);
  });
});
