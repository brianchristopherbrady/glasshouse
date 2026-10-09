import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { AgentEvent } from '@brianbrady/glasshouse-domain';

/**
 * Appends one event as a single ndjson line — the offline/no-network-access
 * fallback path for a process that can't reach the server directly. A
 * separate consumer (e.g. `agentic-flows ingest <file>`) reads these back
 * and forwards them via the batch telemetry endpoint.
 */
export function appendEventToFile(event: AgentEvent, filePath: string): void {
  appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8');
}

/** Reads every event written by appendEventToFile, skipping malformed/partial lines. */
export function readEventsFromFile(filePath: string): AgentEvent[] {
  if (!existsSync(filePath)) return [];
  const events: AgentEvent[] = [];
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as AgentEvent);
    } catch {
      // Skip a malformed/partially-written line rather than failing the whole read.
    }
  }
  return events;
}
