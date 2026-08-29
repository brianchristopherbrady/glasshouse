// Read-side HTTP API: list sessions, fetch a session's events (optionally up
// to a timestamp for replay scrubbing), and compute deterministic metrics.
import { Router } from "express";
import { listSessionIds, readSessionEvents } from "../shared/event-store.js";
import { computeSessionMetrics } from "../shared/metrics.js";
import { getAllSessionMeta, updateSessionMeta } from "../shared/session-meta.js";

export const replayRouter = Router();

replayRouter.get("/api/sessions", async (_req, res) => {
  const [ids, meta] = await Promise.all([listSessionIds(), getAllSessionMeta()]);
  const sessions = ids.map((id) => ({ id, ...(meta[id] ?? { saved: false }) }));
  res.json({ sessions });
});

replayRouter.get("/api/sessions/:id/events", async (req, res) => {
  const events = await readSessionEvents(req.params.id);
  const upTo = typeof req.query.upTo === "string" ? req.query.upTo : undefined;
  const filtered = upTo ? events.filter((e) => e.timestamp <= upTo) : events;
  res.json({ events: filtered });
});

replayRouter.get("/api/sessions/:id/metrics", async (req, res) => {
  const events = await readSessionEvents(req.params.id);
  res.json({ metrics: computeSessionMetrics(events) });
});

// Sets a friendly label and/or a "saved" flag on a session. This is purely
// metadata layered on top of the JSONL event log -- every session already
// persists forever regardless of this endpoint; "saved" only marks intent
// so Replay/Compare can distinguish runs worth keeping from incidental ones.
replayRouter.patch("/api/sessions/:id", async (req, res) => {
  const { label, saved } = req.body ?? {};
  if (label !== undefined && typeof label !== "string") {
    res.status(400).json({ error: "label must be a string" });
    return;
  }
  if (saved !== undefined && typeof saved !== "boolean") {
    res.status(400).json({ error: "saved must be a boolean" });
    return;
  }
  const meta = await updateSessionMeta(req.params.id, { label, saved });
  res.json({ session: { id: req.params.id, ...meta } });
});
