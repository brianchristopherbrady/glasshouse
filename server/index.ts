// AGENTARIUM collector + API server: ingests hook/MCP events, persists them,
// and streams them live to the React client over Server-Sent Events.
import express from "express";
import cors from "cors";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectorRouter, ingestEvent } from "./collector.js";
import { replayRouter } from "./replay.js";
import { repoRouter } from "./repo.js";
import { worldRouter } from "./world.js";
import { bookRouter } from "./book.js";
import { narrativeRouter } from "./narrative.js";
import { getCurrentSessionId } from "./session.js";
import { subscribe } from "./eventBus.js";
import { createEvent, AgentariumEventSchema } from "../shared/events.js";
import { COLLECTOR_PORT, CLIENT_URL } from "../shared/config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(collectorRouter);
app.use(replayRouter);
app.use(repoRouter);
app.use(worldRouter);
app.use(bookRouter);
app.use(narrativeRouter);

app.get("/api/current-session", async (_req, res) => {
  const sessionId = await getCurrentSessionId();
  res.json({ sessionId });
});

// Manual development endpoint: lets you inject a synthetic event without a
// real agent session running, per charter.md Phase 4 ("Create a manual
// endpoint or script to inject development events").
app.post("/api/dev/emit", async (req, res) => {
  try {
    const sessionId = req.body.sessionId ?? (await getCurrentSessionId()) ?? "dev-session";
    const event = createEvent({ ...req.body, sessionId });
    const stored = await ingestEvent(event);
    res.status(202).json({ event: stored });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

const DEMO_DIR = path.resolve(process.cwd(), "demo");

app.get("/api/demo", async (_req, res) => {
  try {
    const files = await readdir(DEMO_DIR);
    res.json({ traces: files.filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(/\.jsonl$/, "")) });
  } catch {
    res.json({ traces: [] });
  }
});

app.get("/api/demo/:name/events", async (req, res) => {
  try {
    const raw = await readFile(path.join(DEMO_DIR, `${req.params.name}.jsonl`), "utf-8");
    const events = raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => AgentariumEventSchema.parse(JSON.parse(line)));
    res.json({ events });
  } catch (err) {
    res.status(404).json({ error: `demo trace not found: ${req.params.name}`, detail: String(err) });
  }
});

// Live event stream. Clients may pass ?sessionId= to filter; otherwise they
// receive every event across all sessions (fine for a single-user local tool).
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sessionFilter = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;

  const unsubscribe = subscribe((event) => {
    if (sessionFilter && event.sessionId !== sessionFilter) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => res.write(":keep-alive\n\n"), 15_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

app.listen(COLLECTOR_PORT, () => {
  console.log("AGENTARIUM");
  console.log(`Collector: http://localhost:${COLLECTOR_PORT}`);
  console.log(`Dashboard: ${CLIENT_URL}`);
});
