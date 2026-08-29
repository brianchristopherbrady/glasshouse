// flowbook collector + API server: ingests hook/MCP events,
// persists them, and streams them live to the React client over
// Server-Sent Events.
import express from "express";
import cors from "cors";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectorRouter, ingestEvent } from "./collector.js";
import { replayRouter } from "./replay.js";
import { repoRouter } from "./repo.js";
import { narrativeRouter } from "./narrative.js";
import { workspaceRouter } from "./workspace.js";
import { runnerRouter } from "./runnerRoutes.js";
import "./runner/index.js"; // side-effect: registers every real (built-in) workflow
import { discoverWorkflows } from "./runner/discovery.js";
import { subscribeToRuns } from "./runner/runBus.js";
import { getCurrentSessionId, getCurrentRun } from "./session.js";
import { subscribe } from "./eventBus.js";
import { createEvent, FlowbookEventSchema } from "../shared/events.js";
import { COLLECTOR_PORT, CLIENT_URL } from "../shared/config.js";
import { REPO_ROOT, repoPath, packagePath } from "../shared/paths.js";
import { existsSync } from "node:fs";

// Loads whatever workflows the WATCHED repo declares in its own
// flowbook.config.* (if any), on top of this package's built-in
// document-refactor demo -- a no-op for a repo with no config. Must
// happen before app.listen() so the runner routes see every workflow from
// the very first request, not just ones registered after a race.
const discovery = await discoverWorkflows(REPO_ROOT);
if (discovery.loaded.length > 0) {
  console.log(`flowbook: loaded ${discovery.loaded.length} workflow module(s) from ${REPO_ROOT}`);
}
for (const failure of discovery.failed) {
  console.error(`flowbook: failed to load workflow module ${failure.file}: ${failure.error}`);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(collectorRouter);
app.use(replayRouter);
app.use(repoRouter);
app.use(narrativeRouter);
app.use(workspaceRouter);
app.use(runnerRouter);

app.get("/api/current-session", async (_req, res) => {
  const sessionId = await getCurrentSessionId();
  res.json({ sessionId });
});

app.get("/api/current-run", async (_req, res) => {
  const run = await getCurrentRun();
  res.json({ run });
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

const DEMO_DIR = repoPath("demo");

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
      .map((line) => FlowbookEventSchema.parse(JSON.parse(line)));
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

// Live Run/Span stream for the real orchestrator (see server/runner/).
// Separate from /api/stream -- distinct source (this process executing a
// workflow, not an observed VS Code session), same broadcast pattern.
app.get("/api/runner/stream", (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unsubscribe = subscribeToRuns((update) => {
    res.write(`data: ${JSON.stringify(update)}\n\n`);
  });

  const keepAlive = setInterval(() => res.write(":keep-alive\n\n"), 15_000);

  _req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

// Packaged/production mode: serve the pre-built dashboard (dist/) directly
// from this same process/port, so a globally-installed CLI doesn't need a
// separate Vite dev server. In local development (`npm start`), dist/ won't
// exist yet and Vite serves the UI on its own port instead -- this block is
// then simply skipped.
const DIST_DIR = packagePath("dist");
let servingDashboard = false;
if (existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
  servingDashboard = true;
}

app.listen(COLLECTOR_PORT, () => {
  console.log("FLOWBOOK");
  console.log(`Collector: http://localhost:${COLLECTOR_PORT}`);
  console.log(`Dashboard: ${servingDashboard ? `http://localhost:${COLLECTOR_PORT}` : CLIENT_URL}`);
});
