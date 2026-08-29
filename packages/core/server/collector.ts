// Accepts normalized events (from the hook script, MCP server, or the dev
// injection endpoint), validates + redacts them, persists to JSONL, and
// broadcasts to any connected SSE clients.
import { Router } from "express";
import { z } from "zod";
import { FlowbookEventSchema, type FlowbookEvent } from "../shared/events.js";
import { redactEventPayload } from "../shared/redaction.js";
import { appendEvent } from "../shared/event-store.js";
import { setCurrentSessionId } from "./session.js";
import { publish } from "./eventBus.js";

const IngestBodySchema = z.union([
  z.object({ events: z.array(FlowbookEventSchema) }),
  FlowbookEventSchema,
]);

/** Shared ingestion path used by both the HTTP route and the MCP server. */
export async function ingestEvent(event: FlowbookEvent): Promise<FlowbookEvent> {
  const redacted = redactEventPayload(event);
  const stored = await appendEvent(redacted);
  await setCurrentSessionId(stored.sessionId);
  publish(stored);
  return stored;
}

export const collectorRouter = Router();

collectorRouter.post("/api/events", async (req, res) => {
  const parsed = IngestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid event payload", issues: parsed.error.issues });
    return;
  }

  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  try {
    const stored = await Promise.all(events.map((e) => ingestEvent(e)));
    res.status(202).json({ accepted: stored.length });
  } catch (err) {
    res.status(500).json({ error: "failed to persist events", detail: String(err) });
  }
});

/**
 * Broadcast-only endpoint for out-of-process writers (the hook script, the
 * MCP server) that already appended these events to disk themselves. Does
 * NOT call appendEvent — that would duplicate the JSONL line. Only
 * republishes on the live SSE bus and updates the "current session" pointer.
 */
collectorRouter.post("/api/events/notify", async (req, res) => {
  const parsed = IngestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid event payload", issues: parsed.error.issues });
    return;
  }

  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  try {
    for (const event of events) {
      const redacted = redactEventPayload(event);
      await setCurrentSessionId(redacted.sessionId);
      publish(redacted);
    }
    res.status(202).json({ notified: events.length });
  } catch (err) {
    res.status(500).json({ error: "failed to broadcast events", detail: String(err) });
  }
});
