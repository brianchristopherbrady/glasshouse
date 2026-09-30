import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { createAuthHook } from '../src/auth.js';

async function buildApp(token: string) {
  const app = Fastify();
  app.addHook('onRequest', createAuthHook(token));
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/repositories', async () => ([{ id: 'repo_1' }]));
  return app;
}

describe('createAuthHook', () => {
  it('always allows /api/health without a token', async () => {
    const app = await buildApp('secret');
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a protected route with no Authorization header', async () => {
    const app = await buildApp('secret');
    const res = await app.inject({ method: 'GET', url: '/api/repositories' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a protected route with the wrong token', async () => {
    const app = await buildApp('secret');
    const res = await app.inject({
      method: 'GET',
      url: '/api/repositories',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows a protected route with the correct bearer token', async () => {
    const app = await buildApp('secret');
    const res = await app.inject({
      method: 'GET',
      url: '/api/repositories',
      headers: { authorization: 'Bearer secret' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'repo_1' }]);
  });
});
