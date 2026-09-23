import Fastify from 'fastify';
import cors from '@fastify/cors';
import { repositoriesRoutes } from './routes/repositories.js';
import { runsRoutes } from './routes/runs.js';
import { telemetryRoutes } from './routes/telemetry.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/api/health', async () => ({ ok: true }));

await app.register(repositoriesRoutes);
await app.register(runsRoutes);
await app.register(telemetryRoutes);

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
