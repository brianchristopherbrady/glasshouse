// Read-only HTTP API for the Workspace Map: the repo's real member graph
// (see shared/workspace-graph.ts for its three discovery sources: explicit
// config, package-manager workspaces, or a folder heuristic) for the repo
// being watched, plus a per-session activity overlay (which members a
// session's real events touched, and which members were explicitly
// declared linked via workspace.linked events). See
// shared/workspace-activity.ts for how the overlay half is computed --
// nothing here is invented.
import { Router } from "express";
import { discoverWorkspaceGraph } from "../shared/workspace-graph.js";
import { computeWorkspaceActivity, extractWorkspaceLinks } from "../shared/workspace-activity.js";
import { readSessionEvents } from "../shared/event-store.js";
import { REPO_ROOT } from "../shared/paths.js";

export const workspaceRouter = Router();

workspaceRouter.get("/api/workspaces", async (_req, res) => {
  try {
    const graph = await discoverWorkspaceGraph(REPO_ROOT);
    res.json({ graph });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

workspaceRouter.get("/api/workspaces/sessions/:id/activity", async (req, res) => {
  try {
    const [graph, events] = await Promise.all([
      discoverWorkspaceGraph(REPO_ROOT),
      readSessionEvents(req.params.id),
    ]);
    const touches = computeWorkspaceActivity(events, graph);
    const links = extractWorkspaceLinks(events);
    res.json({ touches, links });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
