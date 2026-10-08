import type { AgentEvent, RunCorrelation } from '@agentic-flows/domain';

/**
 * Run correlation for code executing inside a GitHub Actions job, read from
 * the runner's own GITHUB_REPOSITORY / GITHUB_RUN_ID. Returns null outside
 * Actions so callers can fall back to an explicit runId.
 */
export function githubActionsCorrelation(env: NodeJS.ProcessEnv = process.env): RunCorrelation | null {
  const repository = env.GITHUB_REPOSITORY;
  const providerRunId = env.GITHUB_RUN_ID;
  return repository && providerRunId ? { repository, providerRunId } : null;
}

export interface TelemetryClientOptions {
  /** Base URL of the Agentic Flows server, e.g. "http://localhost:4000". */
  baseUrl: string;
  /** Sent as `Authorization: Bearer <apiToken>` if the server has AGENTIC_FLOWS_API_TOKEN set. */
  apiToken?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Retries for transient (network or 5xx) failures only — never for 4xx. */
  maxRetries?: number;
  /** Base delay for exponential backoff between retries, in ms. */
  retryDelayMs?: number;
}

export interface TelemetryClient {
  emit(event: AgentEvent): Promise<void>;
  emitBatch(events: AgentEvent[]): Promise<void>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  maxRetries: number,
  retryDelayMs: number,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      if (attempt > maxRetries) throw err;
      await delay(retryDelayMs * 2 ** (attempt - 1));
      continue;
    }
    if (res.ok) return;
    // A 4xx means the event itself is invalid/unauthorized — retrying would
    // just reproduce the same failure. Only 5xx/network errors are retried.
    if (res.status < 500 || attempt > maxRetries) {
      const text = await res.text().catch(() => '');
      throw new Error(`telemetry POST ${url} failed: ${res.status} ${text}`);
    }
    await delay(retryDelayMs * 2 ** (attempt - 1));
  }
}

export function createTelemetryClient(options: TelemetryClientOptions): TelemetryClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.apiToken) headers.Authorization = `Bearer ${options.apiToken}`;

  return {
    async emit(event) {
      await postWithRetry(`${baseUrl}/api/telemetry/events`, event, headers, fetchImpl, maxRetries, retryDelayMs);
    },
    async emitBatch(events) {
      await postWithRetry(
        `${baseUrl}/api/telemetry/batch`,
        { events },
        headers,
        fetchImpl,
        maxRetries,
        retryDelayMs,
      );
    },
  };
}
