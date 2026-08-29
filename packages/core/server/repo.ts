// Read-only introspection of the repository's authored agent/skill/prompt
// artifacts, so the dashboard's Repository view reflects what actually
// exists on disk rather than a hardcoded list.
import { Router } from "express";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { repoPath } from "../shared/paths.js";

const AGENTS_DIR = repoPath(".github", "agents");
const SKILLS_DIR = repoPath(".github", "skills");
const PROMPTS_DIR = repoPath(".github", "prompts");

// Minimal frontmatter reader: pulls top-level scalar `name:`/`description:`
// values out of the leading `---` block. Deliberately not a full YAML
// parser — the frontmatter here is simple, and this avoids a new dependency
// for two string fields.
function readFrontmatterField(source: string, field: string): string | undefined {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const block = match[1] ?? "";
  for (const line of block.split(/\r?\n/)) {
    const fieldMatch = line.match(new RegExp(`^${field}:\\s*(.+)$`));
    if (fieldMatch) {
      return fieldMatch[1]!.trim().replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

export const repoRouter = Router();

repoRouter.get("/api/repo/agents", async (_req, res) => {
  try {
    const files = (await readdir(AGENTS_DIR)).filter((f) => f.endsWith(".agent.md"));
    const agents = await Promise.all(
      files.map(async (file) => {
        const source = await readFile(path.join(AGENTS_DIR, file), "utf-8");
        return {
          file,
          name: readFrontmatterField(source, "name") ?? file.replace(/\.agent\.md$/, ""),
          description: readFrontmatterField(source, "description"),
        };
      })
    );
    res.json({ agents });
  } catch {
    res.json({ agents: [] });
  }
});

repoRouter.get("/api/repo/skills", async (_req, res) => {
  try {
    const dirs = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills = await Promise.all(
      dirs
        .filter((d) => d.isDirectory())
        .map(async (d) => {
          const source = await readFile(path.join(SKILLS_DIR, d.name, "SKILL.md"), "utf-8");
          return {
            dir: d.name,
            name: readFrontmatterField(source, "name") ?? d.name,
            description: readFrontmatterField(source, "description"),
          };
        })
    );
    res.json({ skills });
  } catch {
    res.json({ skills: [] });
  }
});

repoRouter.get("/api/repo/prompts", async (_req, res) => {
  try {
    const files = (await readdir(PROMPTS_DIR)).filter((f) => f.endsWith(".prompt.md"));
    const prompts = await Promise.all(
      files.map(async (file) => {
        const source = await readFile(path.join(PROMPTS_DIR, file), "utf-8");
        return {
          file,
          name: file.replace(/\.prompt\.md$/, ""),
          description: readFrontmatterField(source, "description"),
        };
      })
    );
    res.json({ prompts });
  } catch {
    res.json({ prompts: [] });
  }
});
