// Shared helper for out-of-process event writers (currently: the MCP server)
// that must persist events to disk directly and only use the collector HTTP
// API for a best-effort live-broadcast notification. See
// /memories/repo notes ("Event dual-write pattern") for why this split
// exists: POSTing to /api/events from a writer that already appended to disk
// itself would duplicate the JSONL line, so we notify via
// /api/events/notify instead, which republishes on the SSE bus without
// writing to disk again.
import { appendEvent } from "./event-store.js";
import { redactEventPayload } from "./redaction.js";
import { COLLECTOR_URL } from "./config.js";
import type { AgentariumEvent } from "./events.js";

const NOTIFY_TIMEOUT_MS = 1200;

/**
 * Persists an event to its session's JSONL file (the source of truth,
 * always works even if no dashboard is running), then makes a best-effort
 * attempt to notify a live collector server so connected dashboards update
 * immediately. Never throws due to the notify step failing.
 */
export async function recordAndNotify(event: AgentariumEvent): Promise<AgentariumEvent> {
  const redacted = redactEventPayload(event);
  const stored = await appendEvent(redacted);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);
    await fetch(`${COLLECTOR_URL}/api/events/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [stored] }),
      signal: controller.signal,
    }).catch(() => {
      // Collector not running / unreachable — the event is already safely
      // on disk, so this is fine, not an error.
    });
    clearTimeout(timer);
  } catch {
    // Never let a broadcast failure surface as a tool failure.
  }

  return stored;
}
