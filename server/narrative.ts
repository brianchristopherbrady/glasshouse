// Generic narrative API: serves/accepts the Storyboard and Book layer
// described in shared/narrative-types.ts. Independent of server/book.ts
// (which is specifically this repo's world/<agent>_actions fiction ledger).
// GET routes read straight from disk. PUT routes are the agent-performed
// generation path (see .github/skills/event-storyboard and
// .github/skills/event-book) -- there is no server-side generation logic
// here, only storage, exactly like world/storyboard.json is hand-authored
// today.
import { Router } from "express";
import {
  readNarrationConfig,
  readNarrativeBook,
  readStoryboard,
  writeNarrativeBook,
  writeStoryboard,
} from "../shared/narrative-store.js";
import type { NarrativeBeat, BookSection } from "../shared/narrative-types.js";

export const narrativeRouter = Router();

narrativeRouter.get("/api/narrative/config", async (_req, res) => {
  const config = await readNarrationConfig();
  res.json({ config });
});

narrativeRouter.get("/api/narrative/:sessionId/storyboard", async (req, res) => {
  const storyboard = await readStoryboard(req.params.sessionId);
  res.json({ storyboard });
});

narrativeRouter.put("/api/narrative/:sessionId/storyboard", async (req, res) => {
  try {
    const beats = req.body?.beats;
    if (!Array.isArray(beats)) {
      res.status(400).json({ error: "body.beats must be an array of NarrativeBeat" });
      return;
    }
    const storyboard = {
      sessionId: req.params.sessionId,
      generatedAt: new Date().toISOString(),
      beats: beats as NarrativeBeat[],
    };
    await writeStoryboard(storyboard);
    res.json({ storyboard });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

narrativeRouter.get("/api/narrative/:sessionId/book", async (req, res) => {
  const book = await readNarrativeBook(req.params.sessionId);
  res.json({ book });
});

narrativeRouter.put("/api/narrative/:sessionId/book", async (req, res) => {
  try {
    const sections = req.body?.sections;
    if (!Array.isArray(sections)) {
      res.status(400).json({ error: "body.sections must be an array of BookSection" });
      return;
    }
    const config = await readNarrationConfig();
    const book = {
      sessionId: req.params.sessionId,
      style: config.style,
      title: typeof req.body?.title === "string" ? req.body.title : "Session narration",
      generatedAt: new Date().toISOString(),
      sections: sections as BookSection[],
    };
    await writeNarrativeBook(book);
    res.json({ book });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});
