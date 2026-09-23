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
});
