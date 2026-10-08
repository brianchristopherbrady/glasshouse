import { describe, expect, it } from 'vitest';
import { AgentEventSchema } from '../src/events.js';

describe('AgentEventSchema', () => {
  const base = {
    id: 'evt_1',
    runId: 'run_1',
    timestamp: new Date().toISOString(),
    kind: 'agent.started' as const,
    data: {},
    evidence: { source: 'runtime' as const, confidence: 'observed' as const },
  };

  it('accepts a minimal valid event', () => {
    expect(AgentEventSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an unknown event kind', () => {
    const result = AgentEventSchema.safeParse({ ...base, kind: 'not.a.real.kind' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing evidence field', () => {
    const withoutEvidence: Record<string, unknown> = { ...base };
    delete withoutEvidence.evidence;
    const result = AgentEventSchema.safeParse(withoutEvidence);
    expect(result.success).toBe(false);
  });

  it('accepts a GitHub Actions correlation instead of an internal runId', () => {
    const result = AgentEventSchema.safeParse({
      ...base,
      runId: undefined,
      correlation: { repository: 'acme/payments', providerRunId: '123456' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an event with neither runId nor correlation', () => {
    expect(AgentEventSchema.safeParse({ ...base, runId: undefined }).success).toBe(false);
  });

  it('rejects a malformed correlation repository', () => {
    const result = AgentEventSchema.safeParse({
      ...base,
      correlation: { repository: '../../etc', providerRunId: '1' },
    });
    expect(result.success).toBe(false);
  });
});
