// Read-only introspection of The Float's actual world state, straight from
// world/*.json on disk. This is what makes the "built world" persist across
// dashboard page loads: it's not client-side state at all, it's the same
// files Asterion Dev edits and the validator checks.
import { Router } from "express";
import { loadWorld } from "../shared/world-loader.js";
import { validateWorld } from "../shared/world-validator.js";

export const worldRouter = Router();

worldRouter.get("/api/world", async (_req, res) => {
  try {
    const world = await loadWorld();
    const validation = validateWorld(world);
    res.json({ world, validation });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
