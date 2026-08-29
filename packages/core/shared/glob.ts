// Generic file-glob expansion for repository discovery (flowbook.config's
// `workflows` patterns) -- distinct from shared/workspace-graph.ts's
// expandGlob, which only matches DIRECTORIES containing a package.json.
// This one matches real FILES against an arbitrary pattern, supporting the
// same npm-workspaces-style subset: `*` (one path segment, with wildcard
// chars allowed within a segment, e.g. `*.workflow.ts`) and `**` (zero or
// more segments). Deliberately hand-rolled (no glob dependency) -- same
// tradeoff already made for workspace-graph.ts.
import { readdir } from "node:fs/promises";
import path from "node:path";

function regexForSegment(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/** Expands one glob pattern (relative to `repoRoot`) into real file paths
 * (relative to `repoRoot`, forward-slash-joined) that exist on disk.
 * Skips `node_modules` at every level. Returns `[]` (not an error) for a
 * pattern that matches nothing. */
export async function expandFileGlob(repoRoot: string, pattern: string): Promise<string[]> {
  const segments = pattern.split("/").filter((s) => s.length > 0 && s !== ".");
  const results = new Set<string>();

  async function listDir(dir: string) {
    try {
      return await readdir(path.join(repoRoot, dir), { withFileTypes: true });
    } catch {
      return [];
    }
  }

  async function walk(currentDir: string, segIndex: number): Promise<void> {
    if (segIndex >= segments.length) {
      // Whole pattern consumed against a directory -- every file directly
      // inside it matches (this is the terminal case for a pattern ending
      // in `**`, e.g. "workflows/**").
      for (const entry of await listDir(currentDir)) {
        if (entry.isFile()) results.add(path.join(currentDir, entry.name));
      }
      return;
    }

    const seg = segments[segIndex]!;
    const entries = await listDir(currentDir);

    if (seg === "**") {
      // Zero-segment match: the rest of the pattern applies right here...
      await walk(currentDir, segIndex + 1);
      // ...or descend one level and retry "**" (and beyond) from there.
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "node_modules") {
          await walk(path.join(currentDir, entry.name), segIndex);
        }
      }
      return;
    }

    const isLastSegment = segIndex === segments.length - 1;
    const regex = regexForSegment(seg);
    if (isLastSegment) {
      for (const entry of entries) {
        if (entry.isFile() && regex.test(entry.name)) results.add(path.join(currentDir, entry.name));
      }
    } else {
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "node_modules" && regex.test(entry.name)) {
          await walk(path.join(currentDir, entry.name), segIndex + 1);
        }
      }
    }
  }

  await walk("", 0);
  return [...results].map((r) => r.split(path.sep).join("/"));
}
