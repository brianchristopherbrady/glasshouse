import { describe, expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendEventToFile, readEventsFromFile } from '../src/ndjson.js';
import type { AgentEvent } from '@agentic-flows/domain';

const sampleEvent: AgentEvent = {
  id: 'evt_1',
  runId: 'run_1',
  timestamp: new Date().toISOString(),
  kind: 'tool.started',
  data: { foo: 'bar' },
  evidence: { source: 'runtime', confidence: 'observed' },
};

describe('ndjson file round-trip', () => {
  it('returns an empty array when the file does not exist', () => {
    expect(readEventsFromFile(path.join(tmpdir(), 'does-not-exist.ndjson'))).toEqual([]);
  });

  it('appends and reads back events in order', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'telemetry-client-test-'));
    const file = path.join(dir, 'events.ndjson');
    try {
      appendEventToFile(sampleEvent, file);
      appendEventToFile({ ...sampleEvent, id: 'evt_2' }, file);
      const events = readEventsFromFile(file);
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('evt_1');
      expect(events[1].id).toBe('evt_2');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips a malformed line instead of throwing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'telemetry-client-test-'));
    const file = path.join(dir, 'events.ndjson');
    try {
      appendEventToFile(sampleEvent, file);
      // Simulate a partially-written line from a crashed writer.
      appendFileSync(file, '{"id": "evt_2", "runId": incomplete\n', 'utf8');
      appendEventToFile({ ...sampleEvent, id: 'evt_3' }, file);
      const events = readEventsFromFile(file);
      expect(events.map((e) => e.id)).toEqual(['evt_1', 'evt_3']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
