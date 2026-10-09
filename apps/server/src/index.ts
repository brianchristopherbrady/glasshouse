import { buildApp } from './app.js';
import { prisma } from './db.js';
import { flushMonitoring, initMonitoring, reportError } from './monitoring.js';

// Replaced with the package version by scripts/bundle.mjs; absent under tsx/tsc.
declare const __APP_VERSION__: string | undefined;
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const monitoringEnabled = await initMonitoring(version);
const app = await buildApp({ prisma, logger: { level: process.env.LOG_LEVEL ?? 'info' } });
app.log.info({ version }, 'agentic-flows server starting');
if (monitoringEnabled) app.log.info('error monitoring enabled (Sentry)');

process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'unhandled promise rejection');
  reportError(reason, { kind: 'unhandledRejection' });
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down: draining in-flight requests');
  // Never hang forever if a connection refuses to drain.
  const force = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  force.unref();
  try {
    await app.close();
    await prisma.$disconnect();
    await flushMonitoring();
  } finally {
    process.exit(0);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  reportError(err, { kind: 'startup' });
  await flushMonitoring();
  process.exit(1);
}
