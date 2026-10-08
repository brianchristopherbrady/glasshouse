import { redactSecretsDeep } from '@agentic-flows/domain';

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;

/**
 * Enables Sentry only when SENTRY_DSN is set. The SDK is imported lazily so
 * deployments without monitoring never load it.
 */
export async function initMonitoring(release: string): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  sentry = await import('@sentry/node');
  sentry.init({
    dsn,
    release,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0,
    // Same redaction the UI applies: tokens/keys never leave the process.
    beforeSend: (event) => redactSecretsDeep(event),
  });
  return true;
}

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  sentry?.captureException(error, { extra: redactSecretsDeep(context) });
}

export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  await sentry?.flush(timeoutMs);
}
