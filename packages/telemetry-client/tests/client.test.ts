import { describe, expect, it, vi } from 'vitest';
import { createTelemetryClient } from '../src/client.js';
import type { AgentEvent } from '@agentic-flows/domain';

const sampleEvent: AgentEvent = {
  id: 'evt_1',
  runId: 'run_1',
  timestamp: new Date().toISOString(),
  kind: 'tool.started',
  data: {},
  evidence: { source: 'runtime', confidence: 'observed' },
};

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 201 });
}

describe('createTelemetryClient', () => {
  it('POSTs a single event to /api/telemetry/events', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const client = createTelemetryClient({ baseUrl: 'http://localhost:4000', fetchImpl });
    await client.emit(sampleEvent);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/telemetry/events');
    expect(JSON.parse(init.body)).toEqual(sampleEvent);
  });

  it('POSTs a batch to /api/telemetry/batch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const client = createTelemetryClient({ baseUrl: 'http://localhost:4000/', fetchImpl });
    await client.emitBatch([sampleEvent]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/telemetry/batch');
    expect(JSON.parse(init.body)).toEqual({ events: [sampleEvent] });
  });

  it('includes the Authorization header when an apiToken is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const client = createTelemetryClient({
      baseUrl: 'http://localhost:4000',
      apiToken: 'secret',
      fetchImpl,
    });
    await client.emit(sampleEvent);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer secret');
  });

  it('retries on a 500 and succeeds once the server recovers', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(okResponse());
    const client = createTelemetryClient({
      baseUrl: 'http://localhost:4000',
      fetchImpl,
      retryDelayMs: 1,
    });
    await client.emit(sampleEvent);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a 400 — fails immediately', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('bad event', { status: 400 }));
    const client = createTelemetryClient({ baseUrl: 'http://localhost:4000', fetchImpl });
    await expect(client.emit(sampleEvent)).rejects.toThrow(/400/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
