// Mechanical, non-LLM discovery of a repo's real high-level member
// structure -- this is the data source for the Workspace Map. Not every
// repo is a monorepo, so discovery tries three real sources in order and
// stops at the first that produces anything:
//
//   1. `config`           -- the repo's own flowbook.members.json, if
//                             present. This is the only source that can
//                             express real hierarchy or non-code members
//                             (book chapters, doc sections, etc.) -- see
//                             .github/skills/map-members for how an agent
//                             authors/maintains it.
//   2. `package-manager`   -- npm/yarn/pnpm `workspaces` config, same
//                             mechanical package.json discovery this module
//                             originally shipped with.
//   3. `folder-heuristic`  -- no config, no workspaces: one member per
//                             top-level directory (skipping well-known
//                             noise dirs), so a plain app or content repo
//                             still gets *some* real map instead of nothing.
//
// Everything here is read straight off disk. Nothing is inferred or
// guessed beyond "this directory exists" for the folder-heuristic case --
// see shared/workspace-types.ts's `MemberSource` for what each value means
// and honestly does NOT mean.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { MembersConfigSchema, type WorkspaceGraph, type WorkspaceMember, type WorkspaceDependencyEdge } from "./workspace-types.js";

interface RawPackageJson {
  name?: string;
  version?: string;
  description?: string;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function edgesFromMembers(members: WorkspaceMember[]): WorkspaceDependencyEdge[] {
  const ids = new Set(members.map((m) => m.id));
  const edges: WorkspaceDependencyEdge[] = [];
  for (const m of members) {
    for (const dep of m.dependsOn) {
      if (ids.has(dep)) edges.push({ from: m.id, to: dep });
    }
  }
  return edges;
}

// --- Source 1: flowbook.members.json (config) ---------------------------

const MEMBERS_CONFIG_FILENAME = "flowbook.members.json";

/** Reads the repo's own explicit member map, if one exists. Returns `null`
 * (not an error) when the file is absent -- that's the common case for a
 * repo that hasn't been mapped yet, not a failure. */
async function readMembersConfig(repoRoot: string): Promise<WorkspaceGraph | null> {
  const raw = await readJsonIfExists<unknown>(path.join(repoRoot, MEMBERS_CONFIG_FILENAME));
  if (!raw) return null;
  const parsed = MembersConfigSchema.safeParse(raw);
  if (!parsed.success) return null;

  const members: WorkspaceMember[] = parsed.data.members.map((m) => ({ ...m, source: "config" as const }));
  return { source: "config", members, edges: edgesFromMembers(members) };
}

// --- Source 2: package-manager workspaces -----------------------------

/** Extracts glob patterns from a pnpm-workspace.yaml's `packages:` list
 * without a YAML dependency -- this file's shape is simple enough (a
 * top-level `packages:` key followed by `- "glob"` lines) that a full
 * parser would be overkill for what's otherwise a one-field read. */
async function readPnpmWorkspaceGlobs(repoRoot: string): Promise<string[] | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf-8");
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  const globs: string[] = [];
  let inPackages = false;
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = line.match(/^\s*-\s*["']?([^"'#]+)["']?\s*$/);
      if (match) {
        globs.push(match[1]!.trim());
        continue;
      }
      if (line.trim().length === 0) continue;
      break; // dedented out of the packages: block
    }
  }
  return globs.length > 0 ? globs : null;
}

function workspaceGlobsFromPackageJson(pkg: RawPackageJson): string[] | null {
  if (!pkg.workspaces) return null;
  if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
  if (Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages;
  return null;
}

/** Expands one glob pattern (npm/yarn/pnpm workspace convention: `*` matches
 * exactly one path segment, `**` matches any number of segments, including
 * zero) into real directories under repoRoot that contain a package.json.
 * Deliberately supports only this subset -- it's what every real workspaces
 * config in practice uses, and anything fancier would need a dependency. */
async function expandGlob(repoRoot: string, pattern: string): Promise<string[]> {
  const segments = pattern.split("/").filter((s) => s.length > 0 && s !== ".");
  const results: string[] = [];

  async function walk(currentDir: string, segIndex: number): Promise<void> {
    if (segIndex >= segments.length) {
      if (await readJsonIfExists(path.join(repoRoot, currentDir, "package.json"))) {
        results.push(currentDir);
      }
      return;
    }
    const seg = segments[segIndex]!;
    let entries;
    try {
      entries = await readdir(path.join(repoRoot, currentDir), { withFileTypes: true });
    } catch {
      return;
    }
    const dirs = entries.filter((e) => e.isDirectory() && e.name !== "node_modules");

    if (seg === "**") {
      // Zero-segment match (the rest of the pattern applies right here)...
      await walk(currentDir, segIndex + 1);
      // ...or descend one level and try the same "**" again, plus every
      // subsequent segment, from there.
      for (const dir of dirs) {
        await walk(path.join(currentDir, dir.name), segIndex);
      }
      return;
    }

    if (seg.includes("*")) {
      const regex = new RegExp(`^${seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      for (const dir of dirs) {
        if (regex.test(dir.name)) await walk(path.join(currentDir, dir.name), segIndex + 1);
      }
      return;
    }

    // Literal segment.
    if (dirs.some((d) => d.name === seg)) await walk(path.join(currentDir, seg), segIndex + 1);
  }

  await walk("", 0);
  return results;
}

/** Reads a monorepo's real package.json workspaces structure. Returns
 * `null` (not an error) when no workspaces config is found at all -- that's
 * an honest, common case for a repo that simply isn't a package-manager
 * monorepo, not a failure to detect one. */
async function discoverPackageManagerGraph(repoRoot: string): Promise<WorkspaceGraph | null> {
  const rootPkg = await readJsonIfExists<RawPackageJson>(path.join(repoRoot, "package.json"));
  const globs = (rootPkg && workspaceGlobsFromPackageJson(rootPkg)) ?? (await readPnpmWorkspaceGlobs(repoRoot));
  if (!globs || globs.length === 0) return null;

  const dirsSeen = new Set<string>();
  for (const glob of globs) {
    for (const dir of await expandGlob(repoRoot, glob)) dirsSeen.add(dir);
  }

  const byId = new Map<string, { dir: string; pkg: RawPackageJson }>();
  for (const dir of dirsSeen) {
    const pkg = await readJsonIfExists<RawPackageJson>(path.join(repoRoot, dir, "package.json"));
    if (pkg?.name) byId.set(pkg.name, { dir, pkg });
  }
  if (byId.size === 0) return null;

  const members: WorkspaceMember[] = [];
  for (const [id, { dir, pkg }] of byId) {
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    const dependsOn = Object.keys(allDeps).filter((depName) => byId.has(depName));
    members.push({
      id,
      label: id,
      path: dir.split(path.sep).join("/"),
      kind: "package",
      dependsOn,
      source: "package-manager",
      ...(pkg.version !== undefined && { version: pkg.version }),
      ...(pkg.description !== undefined && { description: pkg.description }),
    });
  }
  members.sort((a, b) => a.id.localeCompare(b.id));
  return { source: "package-manager", members, edges: edgesFromMembers(members) };
}

// --- Source 3: folder heuristic (last resort) ------------------------------

const FOLDER_HEURISTIC_IGNORE = new Set([
  "node_modules",
  ".git",
  ".github",
  ".vscode",
  "dist",
  "build",
  "out",
  ".flowbook",
  ".next",
  ".turbo",
  ".cache",
]);

/** One member per top-level directory, skipping obvious non-content noise.
 * This is a deliberately dumb fallback -- it does not try to guess kind,
 * hierarchy, or dependencies, since none of that is honestly knowable from
 * directory names alone. It exists so a plain app or content repo (a single
 * package.json, a book manuscript, a docs site) still gets a real,
 * non-empty map instead of "nothing to show" every time. */
async function discoverFolderHeuristicGraph(repoRoot: string): Promise<WorkspaceGraph> {
  let entries;
  try {
    entries = await readdir(repoRoot, { withFileTypes: true });
  } catch {
    return { source: "folder-heuristic", members: [], edges: [] };
  }

  const members: WorkspaceMember[] = entries
    .filter((e) => e.isDirectory() && !FOLDER_HEURISTIC_IGNORE.has(e.name) && !e.name.startsWith("."))
    .map((e) => ({
      id: e.name,
      label: e.name,
      path: e.name,
      kind: "folder",
      dependsOn: [],
      source: "folder-heuristic" as const,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { source: "folder-heuristic", members, edges: [] };
}

/** Discovers the repo's real member graph, trying `config` ->
 * `package-manager` -> `folder-heuristic` in order and returning the first
 * source that produces anything. The returned graph's `source` field tells
 * the UI and any agent which path was actually used, so a plain
 * package-manager readout is never confused with a repo a cartographer
 * agent has actually mapped. */
export async function discoverWorkspaceGraph(repoRoot: string): Promise<WorkspaceGraph> {
  const configGraph = await readMembersConfig(repoRoot);
  if (configGraph) return configGraph;

  const packageManagerGraph = await discoverPackageManagerGraph(repoRoot);
  if (packageManagerGraph) return packageManagerGraph;

  return discoverFolderHeuristicGraph(repoRoot);
}
