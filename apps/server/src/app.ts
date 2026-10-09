import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import type { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { repositoriesRoutes } from './routes/repositories.js';
import { runsRoutes } from './routes/runs.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { githubRoutes } from './routes/github.js';
import { webhookRoutes } from './routes/webhooks.js';
import { adminRoutes } from './routes/admin.js';
import { createAuthHook } from './auth.js';
import {
  createGithubTokenResolver,
  loadGithubAppConfig,
  type GithubTokenResolver,
} from './githubAuth.js';
import {
  buildContentSecurityPolicy,
  inlineScriptHashes,
  registerSecurityHeaders,
} from './securityHeaders.js';
import { reportError } from './monitoring.js';

export interface AppOptions {
  prisma: PrismaClient;
  env?: NodeJS.ProcessEnv;
  logger?: FastifyServerOptions['logger'];
  resolveGithubToken?: GithubTokenResolver;
}

/**
 * Finds the built web app. Checked in order: explicit override, the bundled
 * package layout (dist/bundle.mjs + dist/web), then the monorepo layouts for
 * tsc output (dist/src) and tsx dev (src).
 */
export function resolveWebDist(env: NodeJS.ProcessEnv = process.env): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    env.GLASSHOUSE_WEB_DIST,
    path.join(here, 'web'),
    path.resolve(here, '../../../web/dist'),
    path.resolve(here, '../../web/dist'),
  ].filter((c): c is string => Boolean(c));
  return candidates.find((c) => existsSync(path.join(c, 'index.html'))) ?? null;
}

const UNLIMITED_PATHS = new Set(['/api/health', '/api/ready']);

export async function buildApp({
  prisma,
  env = process.env,
  logger = true,
  resolveGithubToken,
}: AppOptions) {
  const app = Fastify({
    logger,
    trustProxy: env.GLASSHOUSE_TRUST_PROXY === 'true',
    bodyLimit: 5 * 1024 * 1024,
  });

  const allowedOrigins = (env.GLASSHOUSE_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, { origin: allowedOrigins });

  // Registered before the auth hook so floods are rejected before any token lookup.
  await app.register(rateLimit, {
    max: Number(env.GLASSHOUSE_RATE_LIMIT_PER_MINUTE ?? 600),
    timeWindow: '1 minute',
    allowList: (req) => !req.url.startsWith('/api/') || UNLIMITED_PATHS.has(req.url.split('?')[0]!),
  });

  const bootstrapToken = env.GLASSHOUSE_API_TOKEN || undefined;
  app.addHook(
    'onRequest',
    createAuthHook({
      bootstrapToken,
      findTokenByHash: (tokenHash) => prisma.apiToken.findUnique({ where: { tokenHash } }),
      markUsed: async (id) => {
        await prisma.apiToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
      },
    }),
  );
  if (!bootstrapToken) {
    app.log.warn(
      'GLASSHOUSE_API_TOKEN is not set — authentication is disabled and every caller is an admin. ' +
        'Fine for local use; set it before exposing this server to anyone else.',
    );
  }

  const webDist = resolveWebDist(env);
  registerSecurityHeaders(
    app,
    buildContentSecurityPolicy(webDist ? inlineScriptHashes(path.join(webDist, 'index.html')) : []),
  );

  // 5xx responses never echo internal error text (Prisma/SQL details, paths).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status =
      typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err }, 'request failed');
      reportError(err, { method: req.method, url: req.url, requestId: req.id });
      return reply.code(500).send({ error: 'internal_error', requestId: req.id });
    }
    return reply.code(status).send({ error: err.code ?? 'request_error', message: err.message });
  });

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false, error: 'database_unavailable' });
    }
  });

  const resolveToken =
    resolveGithubToken ??
    createGithubTokenResolver(loadGithubAppConfig(env), env.GLASSHOUSE_GITHUB_TOKEN);

  await app.register(adminRoutes, { prisma, authEnabled: Boolean(bootstrapToken) });
  await app.register(repositoriesRoutes, { prisma });
  await app.register(runsRoutes, { prisma });
  await app.register(telemetryRoutes, { prisma });
  await app.register(githubRoutes, { prisma, resolveGithubToken: resolveToken });
  await app.register(webhookRoutes, {
    prisma,
    resolveGithubToken: resolveToken,
    secret: env.GLASSHOUSE_GITHUB_WEBHOOK_SECRET || undefined,
  });

  if (webDist) {
    await app.register(staticPlugin, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not_found' });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));
  }

  return app;
}
