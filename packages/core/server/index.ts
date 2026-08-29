// Flowbook's server: the real workflow orchestrator (server/runner/) plus
// its HTTP/SSE API. A Storybook-like tool for agentic workflows -- see
// plan.md / docs/flowbook-vision.md.
import express from "express";
import cors from "cors";
import path from "node:path";
import { runnerRouter } from "./runnerRoutes.js";
import "./runner/index.js"; // side-effect: registers every real (built-in) workflow
import { discoverWorkflows } from "./runner/discovery.js";
import { subscribeToRuns } from "./runner/runBus.js";
import { COLLECTOR_PORT, CLIENT_URL } from "../shared/config.js";
import { REPO_ROOT, packagePath } from "../shared/paths.js";
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

app.use(runnerRouter);

// Live Run/Span stream for the real orchestrator (see server/runner/).
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
