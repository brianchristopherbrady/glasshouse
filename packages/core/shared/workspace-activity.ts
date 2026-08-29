// Mechanical overlay: which real workspace members a session's events
// actually touched, and which actor(s) touched them. Pure reduction over
// already-observed file.read/file.written/file.searched events (same
// no-LLM-involved rule as shared/metrics.ts) -- a path is attributed to a
// member purely by matching against that member's real `path` (a file or a
// directory), nothing here is guessed.
import type { FlowbookEvent } from "./events.js";
import type { WorkspaceGraph, WorkspaceTouch } from "./workspace-types.js";

function metaStr(event: FlowbookEvent, key: string): string | undefined {
  const v = event.metadata?.[key];
  return typeof v === "string" ? v : undefined;
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Finds the most specific (longest `path`) member whose path contains this
 * file path -- a member's `path` may itself be a single file (e.g. a book
 * chapter that's one Markdown file), in which case an exact match counts,
 * or a directory, in which case containment counts. A repo-relative or
 * absolute event path both work, since matching is suffix-based. */
function matchMember(filePath: string, members: WorkspaceGraph["members"]): string | undefined {
  const normalized = normalize(filePath);
  let best: { id: string; pathLen: number } | undefined;
  for (const member of members) {
    const memberPath = normalize(member.path);
    const marker = `/${memberPath}/`;
    const isDirMatch =
      normalized.includes(marker) || normalized.startsWith(`${memberPath}/`) || normalized.endsWith(`/${memberPath}`);
    const isExactFileMatch = normalized === memberPath || normalized.endsWith(`/${memberPath}`);
    if ((isDirMatch || isExactFileMatch) && (!best || memberPath.length > best.pathLen)) {
      best = { id: member.id, pathLen: memberPath.length };
    }
  }
  return best?.id;
}

/** Computes, for one session's events against one real workspace graph,
 * which members were touched, by which files, and by which actors. Only
 * `file.read`/`file.written`/`file.searched` events (all `NEVER_INFERRED`
 * types) are considered -- this is strictly an observed-activity summary.
 * A member with declared children (via `parentId`) is NOT automatically
 * rolled up here -- this function reports the flat per-member facts only;
 * the UI decides whether/how to show "contains/downstream of: <child>,
 * changed" (see src/workspace/WorkspaceMapPanel.tsx). */
export function computeWorkspaceActivity(events: FlowbookEvent[], graph: WorkspaceGraph): WorkspaceTouch[] {
  const byMember = new Map<string, WorkspaceTouch>();

  function touch(memberId: string, kind: "read" | "written" | "searched", filePath: string | undefined, actor: FlowbookEvent["actor"]) {
    let entry = byMember.get(memberId);
    if (!entry) {
      entry = { memberId, filesRead: [], filesWritten: [], filesSearched: [], actors: [] };
      byMember.set(memberId, entry);
    }
    if (filePath) {
      const bucket = kind === "read" ? entry.filesRead : kind === "written" ? entry.filesWritten : entry.filesSearched;
      if (!bucket.includes(filePath)) bucket.push(filePath);
    }
    if (actor && !entry.actors.some((a) => a.id === actor.id)) {
      entry.actors.push({ id: actor.id, ...(actor.name !== undefined && { name: actor.name }) });
    }
  }

  for (const event of events) {
    if (event.type !== "file.read" && event.type !== "file.written" && event.type !== "file.searched") continue;
    const filePath = metaStr(event, "path");
    if (!filePath) continue;
    const memberId = matchMember(filePath, graph.members);
    if (!memberId) continue;
    const kind = event.type === "file.read" ? "read" : event.type === "file.written" ? "written" : "searched";
    touch(memberId, kind, filePath, event.actor);
  }

  return [...byMember.values()];
}

export interface WorkspaceLink {
  from: string;
  to: string;
  reason?: string;
  actor?: { id: string; name?: string };
  eventId: string;
  timestamp: string;
}

/** Extracts every real, agent-declared `workspace.linked` event as a causal
 * edge for the map overlay. Distinct from `WorkspaceGraph.edges` (mechanical
 * package.json/config dependencies): this is what an agent explicitly said
 * it did during a specific session, always `evidence: "declared"`. */
export function extractWorkspaceLinks(events: FlowbookEvent[]): WorkspaceLink[] {
  const links: WorkspaceLink[] = [];
  for (const event of events) {
    if (event.type !== "workspace.linked") continue;
    const from = metaStr(event, "from");
    const to = metaStr(event, "to");
    if (!from || !to) continue;
    links.push({
      from,
      to,
      ...(metaStr(event, "reason") !== undefined && { reason: metaStr(event, "reason") }),
      ...(event.actor !== undefined && { actor: { id: event.actor.id, ...(event.actor.name !== undefined && { name: event.actor.name }) } }),
      eventId: event.id,
      timestamp: event.timestamp,
    });
  }
  return links;
}
