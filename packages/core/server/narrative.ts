// Generic narrative API: serves/accepts the Storyboard layer described in
// shared/narrative-types.ts.
// GET always returns a COMPLETE storyboard: every real StoryBeat in the
// session gets an auto-generated entry (shared/auto-storyboard.ts, no
// agent/LLM required), merged with any agent-authored storyboard persisted
// on disk (that Skill's richer entries win per-beat, see mergeStoryboards).
// This is what makes Storyboard mode useful the moment a session exists,
// instead of an empty wall waiting on someone to run a Skill. PUT is still
// the agent-performed enrichment path (see .github/skills/event-storyboard).
import { Router } from "express";
import { readStoryboard, writeStoryboard } from "../shared/narrative-store.js";
import { buildAutoStoryboard, mergeStoryboards } from "../shared/auto-storyboard.js";
import { buildStoryGraph } from "../shared/story.js";
import { readSessionEvents } from "../shared/event-store.js";
import type { NarrativeBeat } from "../shared/narrative-types.js";

export const narrativeRouter = Router();

narrativeRouter.get("/api/narrative/:sessionId/storyboard", async (req, res) => {
  const sessionId = req.params.sessionId;
  const [events, agentStoryboard] = await Promise.all([readSessionEvents(sessionId), readStoryboard(sessionId)]);
  const graph = buildStoryGraph(events);
  const auto = buildAutoStoryboard(sessionId, graph);
  const storyboard = mergeStoryboards(auto, agentStoryboard);
  res.json({ storyboard });
});

// Read-modify-write, not a full replace: an agent enriching a session
// rarely re-sends every beat (see .github/skills/event-storyboard's "only
// write entries that are genuinely richer" guidance), so a bare overwrite
// here would silently drop earlier enrichment passes for beats this PUT
// didn't mention. New beats in the body override an existing entry with
// the same `beatId`; anything already persisted for a beatId not present
// in this PUT survives untouched.
narrativeRouter.put("/api/narrative/:sessionId/storyboard", async (req, res) => {
  try {
    const beats = req.body?.beats;
    if (!Array.isArray(beats)) {
      res.status(400).json({ error: "body.beats must be an array of NarrativeBeat" });
      return;
    }
    const sessionId = req.params.sessionId;
    const existing = await readStoryboard(sessionId);
    const byBeatId = new Map((existing?.beats ?? []).map((b) => [b.beatId, b] as const));
    for (const beat of beats as NarrativeBeat[]) {
      byBeatId.set(beat.beatId, { ...beat, source: beat.source ?? "agent" });
    }
    const storyboard = {
      sessionId,
      generatedAt: new Date().toISOString(),
      beats: [...byBeatId.values()],
    };
    await writeStoryboard(storyboard);
    res.json({ storyboard });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});
