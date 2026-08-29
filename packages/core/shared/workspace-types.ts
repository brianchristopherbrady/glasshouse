// Schema for the Workspace Map: a real graph of a repo's own high-level
// members -- not every repo is an npm/yarn/pnpm monorepo, so "member" is
// deliberately generic: a package, a plain folder, a single file, a book's
// chapter or part, or anything else a repo's own cartographer agent
// declares. There is nothing invented here at read time -- this file only
// defines the shape; `shared/workspace-graph.ts` is what actually produces
// it, from one of three real sources (see `MemberSourceSchema`). See
// docs/architecture.md for how this composes with the session-activity
// overlay (which members a session's real file.* events touched) and the
// `workspace.linked` declared-edge event type (an agent's own account of
// why touching one member required touching another).
import { z } from "zod";

/** How a member's existence in the graph was actually determined:
 * - `config`: explicitly declared in the repo's own `flowbook.members.json`
 *   (authored/maintained by the cartographer agent, or by hand) -- the
 *   ground truth whenever it exists, since it's the only source that can
 *   express hierarchy, non-code members (chapters, parts), or a shape that
 *   doesn't match any package manager's conventions.
 * - `package-manager`: mechanically discovered from `package.json`
 *   `workspaces` / `pnpm-workspace.yaml`, same as the original monorepo-only
 *   discovery this schema replaces.
 * - `folder-heuristic`: no config and no package-manager workspaces found --
 *   falls back to one member per top-level directory, so a plain
 *   (non-monorepo) app or content repo still gets *some* real map instead
 *   of an empty one. */
export const MemberSourceSchema = z.enum(["config", "package-manager", "folder-heuristic"]);
export type MemberSource = z.infer<typeof MemberSourceSchema>;

/** Common `kind` values other tooling may special-case for icons/labels,
 * but `kind` itself is a free string -- a repo's cartographer agent should
 * feel free to invent a better one (e.g. "chapter", "part", "service",
 * "doc-section") when none of these fit. Never validated against this list;
 * it exists purely as documentation of the common cases. */
export const COMMON_MEMBER_KINDS = [
  "package",
  "folder",
  "file",
  "module",
  "part",
  "chapter",
  "custom",
] as const;

export const WorkspaceMemberSchema = z.object({
  /** Stable id other members reference in `dependsOn`/`parentId`. For a
   * `package-manager`-sourced member this is the real package.json `name`;
   * for `config`/`folder-heuristic` members it's whatever id the source
   * assigned (folder-heuristic uses the folder name). */
  id: z.string(),
  /** Human-readable label, e.g. "Chapter 4: The Long Winter" or "@acme/button-react". */
  label: z.string(),
  /** Path relative to the repo root -- may be a directory (most members) or
   * a single file (e.g. a book chapter that's one Markdown file). Session
   * activity matching treats both correctly (see `matchMember` in
   * shared/workspace-activity.ts). */
  path: z.string(),
  /** Free-text category -- see `COMMON_MEMBER_KINDS` for typical values,
   * but any string is valid. */
  kind: z.string(),
  /** This member's parent, for real declared hierarchy (a book's Part 1
   * containing Chapter 1/2/3; a component package containing a named
   * sub-component). Omitted for top-level members. Only meaningful for
   * `config`-sourced graphs -- `package-manager`/`folder-heuristic`
   * discovery never infers hierarchy on its own. */
  parentId: z.string().optional(),
  description: z.string().optional(),
  /** Package version, when this member came from a real package.json --
   * omitted for members that don't have one (folders, chapters, etc.). */
  version: z.string().optional(),
  /** Other member ids this one depends on/requires. For `package-manager`
   * members this is real `dependencies`/`devDependencies`/`peerDependencies`
   * that resolve to another discovered member; for `config` members it's
   * whatever the cartographer agent (or a human) declared. */
  dependsOn: z.array(z.string()).default([]),
  source: MemberSourceSchema,
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const WorkspaceDependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});
export type WorkspaceDependencyEdge = z.infer<typeof WorkspaceDependencyEdgeSchema>;

export const WorkspaceGraphSchema = z.object({
  /** Which discovery path actually produced this graph -- lets the UI and
   * the cartographer agent distinguish "a human/agent already mapped this
   * repo" from "this is just a package-manager readout" from "nobody has
   * mapped this repo yet, here's a best-effort folder guess". */
  source: MemberSourceSchema,
  members: z.array(WorkspaceMemberSchema),
  /** Derived from every member's own `dependsOn` -- kept as a flat list
   * alongside `members` purely for convenience (same convention as the
   * original package-only graph). */
  edges: z.array(WorkspaceDependencyEdgeSchema),
});
export type WorkspaceGraph = z.infer<typeof WorkspaceGraphSchema>;

/** The on-disk shape of `flowbook.members.json` -- the explicit,
 * agent-or-human-authored member map. See `.github/skills/map-members`. */
export const MembersConfigSchema = z.object({
  members: z.array(WorkspaceMemberSchema.omit({ source: true })),
});
export type MembersConfig = z.infer<typeof MembersConfigSchema>;

/** Mechanical, per-session summary of which members a real event touched --
 * computed by matching file.read/file.written/file.searched paths against
 * each member's real `path`, never authored or guessed. */
export interface WorkspaceTouch {
  memberId: string;
  filesRead: string[];
  filesWritten: string[];
  filesSearched: string[];
  /** Actor ids/names attributed to at least one touch on this member. */
  actors: { id: string; name?: string }[];
}
