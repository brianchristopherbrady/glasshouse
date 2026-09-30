import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { repositoriesRoutes } from './routes/repositories.js';
import { runsRoutes } from './routes/runs.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { githubRoutes } from './routes/github.js';
import { createAuthHook } from './auth.js';

const app = Fastify({ logger: true });

// Origin allowlist instead of reflecting any origin — default matches the
// Vite dev server's own port. Override via a comma-separated env var for
// any other real deployment origin.
const allowedOrigins = (process.env.AGENTIC_FLOWS_ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
await app.register(cors, { origin: allowedOrigins });

// A shared bearer token gates every /api/* route except the health check
// (used by process managers/containers, must stay reachable unauthenticated).
// Unset by default so local/demo use keeps working out of the box — but this
// means `npm start`/the packaged CLI is NOT safe to expose beyond localhost
// without setting this, especially once real GitHub tokens flow through.
const apiToken = process.env.AGENTIC_FLOWS_API_TOKEN;
if (apiToken) {
  app.addHook('onRequest', createAuthHook(apiToken));
} else {
  app.log.warn(
    'AGENTIC_FLOWS_API_TOKEN is not set — every /api route is unauthenticated. ' +
      'Fine for local/demo use; set it before exposing this process beyond localhost.',
  );
}

app.get('/api/health', async () => ({ ok: true }));

await app.register(repositoriesRoutes);
await app.register(runsRoutes);
await app.register(telemetryRoutes);
await app.register(githubRoutes);

// Serves the built web app as a single deployable process whenever its
// dist output exists (production/packaged use). Local dev keeps using
// Vite's own dev server + proxy instead, so this is a no-op unless `web`
// has actually been built — no env var or flag needed to toggle it.
const webDist = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../web/dist');
if (existsSync(webDist)) {
  await app.register(staticPlugin, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not_found' });
  });
}

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
