// Read-only introspection of the world's <agent>_actions/*.md files as an
// interactive, cross-character narrative -- see .github/skills/dispatch and
// .github/skills/downstream. Straight from disk, same as world.ts.
import { Router } from "express";
import { loadBook } from "../shared/book-loader.js";

export const bookRouter = Router();

bookRouter.get("/api/book", async (_req, res) => {
  try {
    const book = await loadBook();
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
