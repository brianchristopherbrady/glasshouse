// Node-only loader: reads world/*.json from disk and validates their shape with Zod.
// Not imported by frontend code (browser bundle has no filesystem access).
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  RelationshipsFileSchema,
  ChangesFileSchema,
  IssuesFileSchema,
  StructuresFileSchema,
  InstitutionsFileSchema,
  type WorldData,
} from "./world-types.js";

export const DEFAULT_WORLD_DIR = path.resolve(process.cwd(), "world");

async function loadJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function loadWorld(worldDir: string = DEFAULT_WORLD_DIR): Promise<WorldData> {
  const [relationships, changes, issues, structures, institutions] = await Promise.all([
    loadJson(path.join(worldDir, "relationships.json")),
    loadJson(path.join(worldDir, "changes.json")),
    loadJson(path.join(worldDir, "issues.json")),
    loadJson(path.join(worldDir, "structures.json")),
    loadJson(path.join(worldDir, "institutions.json")),
  ]);

  return {
    relationships: RelationshipsFileSchema.parse(relationships),
    changes: ChangesFileSchema.parse(changes),
    issues: IssuesFileSchema.parse(issues),
    structures: StructuresFileSchema.parse(structures),
    institutions: InstitutionsFileSchema.parse(institutions),
  };
}
