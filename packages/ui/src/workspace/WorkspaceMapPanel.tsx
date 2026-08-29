// Workspace Map: the repo's REAL member structure (from
// shared/workspace-graph.ts's three-source discovery: an explicit
// flowbook.members.json config, package-manager workspaces, or a
// top-level-folder fallback), overlaid with one session's real activity --
// which members it touched (shared/workspace-activity.ts, from real
// file.read/file.written events) and any causal links an agent explicitly
// declared (workspace.linked events, via the link_workspaces MCP tool).
//
// Rendered as an interactive TREE (a vertically-scrolling, indented,
// click-to-expand list -- like a file explorer), not a spatial node-graph:
// a wide flowchart with every root member laid out side by side forced
// endless horizontal scrolling as soon as a repo had more than a handful of
// top-level members. A tree instead only ever grows *down* -- children
// render as indented rows directly below their parent, regardless of how
// many roots or siblings exist.
//
// Hierarchy: a member can declare `parentId` (real config data -- a book's
// Part 1 containing Chapter 1/2/3, a component package containing a named
// sub-component). Declared children render as real child rows. For a
// member with NO declared children, touched files this session are
// rendered as small synthetic leaf rows instead -- not persisted, not part
// of the graph, purely a session-scoped view of "here's what changed
// inside this member" built directly from real file.read/file.written
// paths (see `computeChildren`).
//
// Progressive disclosure: only root members (no parentId) render by
// default -- a member with children (declared, or synthesizable touched
// files) shows a ▸/▾ caret + count, and clicking it toggles its children
// into/out of the visible list (`expandedIds` state). Ancestors of
// whatever a session actually touched are auto-expanded so real activity
// isn't hidden behind a click.
//
// A tree has no room for spatial edges, so the four relationship kinds
// this repo's model distinguishes are shown as inline chips/text instead
// of drawn lines, and never conflated:
//   - a "deps N" chip           : this member's own mechanical/declared dependencies
//   - a "linked N" chip         : agent-declared workspace.linked events touching it this session
//   - the touched-file rows     : synthetic, session-scoped view of real file.* events
//   - "Also touched this session" in the detail panel : co-occurrence only, never a causation claim
import { useEffect, useMemo, useState } from "react";
import { fetchWorkspaceGraph, fetchWorkspaceActivity, type WorkspaceActivity } from "../api/client.js";
import type { WorkspaceGraph, WorkspaceMember } from "../../../core/shared/workspace-types.js";

const MAX_SYNTHETIC_FILES = 5;

const SOURCE_LABEL: Record<WorkspaceGraph["source"], string> = {
  config: "explicitly mapped (flowbook.members.json)",
  "package-manager": "package-manager workspaces (mechanical)",
  "folder-heuristic": "top-level folders (fallback -- no map or workspaces config found)",
};

type FileLeafKind = "read" | "written" | "searched" | "more";

interface FileLeaf {
  id: string;
  filePath: string;
  kind: FileLeafKind;
  moreCount?: number;
}

type TreeRow =
  | { type: "member"; id: string; member: WorkspaceMember; depth: number; hasChildren: boolean; childCount: number }
  | { type: "file"; id: string; parentId: string; depth: number; leaf: FileLeaf };

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

/** Every member with declared children (`childrenByParent`), plus, for any
 * childless member with real touched files this session, a synthesized set
 * of file-leaf "children" -- computed once so both the tree rows and the
 * high-level row badges (child count, expand caret) agree on what counts
 * as a child, independent of whether that member is expanded. */
function computeChildren(
  graph: WorkspaceGraph,
  touchByMember: Map<string, { filesRead: string[]; filesWritten: string[]; filesSearched: string[] }>,
): {
  childrenByParent: Map<string, WorkspaceMember[]>;
  fileLeaves: Map<string, FileLeaf[]>;
} {
  const childrenByParent = new Map<string, WorkspaceMember[]>();
  for (const m of graph.members) {
    if (!m.parentId) continue;
    (childrenByParent.get(m.parentId) ?? childrenByParent.set(m.parentId, []).get(m.parentId)!).push(m);
  }

  // Synthetic touched-file leaves only apply to members with no declared children.
  const fileLeaves = new Map<string, FileLeaf[]>();
  for (const m of graph.members) {
    if (childrenByParent.has(m.id)) continue;
    const touch = touchByMember.get(m.id);
    if (!touch) continue;
    const all: { filePath: string; kind: "read" | "written" | "searched" }[] = [
      ...touch.filesWritten.map((filePath) => ({ filePath, kind: "written" as const })),
      ...touch.filesRead.map((filePath) => ({ filePath, kind: "read" as const })),
      ...touch.filesSearched.map((filePath) => ({ filePath, kind: "searched" as const })),
    ];
    if (all.length === 0) continue;
    const shown: FileLeaf[] = all.slice(0, MAX_SYNTHETIC_FILES).map((f, i) => ({ id: `file:${m.id}:${i}`, ...f }));
    const overflow = all.length - shown.length;
    if (overflow > 0) shown.push({ id: `file:${m.id}:more`, filePath: "", kind: "more", moreCount: overflow });
    fileLeaves.set(m.id, shown);
  }

  return { childrenByParent, fileLeaves };
}

/** Every ancestor (via `parentId`) of every member this session touched --
 * used to auto-expand the path down to real activity, so a touched member
 * buried under a collapsed parent isn't silently hidden. */
function ancestorsOfTouched(graph: WorkspaceGraph, touchedIds: Iterable<string>): Set<string> {
  const parentOf = new Map(graph.members.map((m) => [m.id, m.parentId] as const));
  const result = new Set<string>();
  for (const id of touchedIds) {
    let current = parentOf.get(id);
    while (current && !result.has(current)) {
      result.add(current);
      current = parentOf.get(current);
    }
  }
  return result;
}

/** Flattens the real `parentId` hierarchy into an ordered, depth-tagged row
 * list, gated by `expandedIds`: a member's children (or synthesized
 * touched-file leaves) only appear in the output when that member's id is
 * in `expandedIds`. Pure and DOM-free on purpose -- this is what makes the
 * tree a plain vertically-stacked list (siblings never spread sideways)
 * instead of a spatial layout problem. */
function buildVisibleRows(
  graph: WorkspaceGraph,
  childrenByParent: Map<string, WorkspaceMember[]>,
  fileLeaves: Map<string, FileLeaf[]>,
  expandedIds: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const roots = [...graph.members.filter((m) => !m.parentId)].sort((a, b) => a.label.localeCompare(b.label));

  function walk(member: WorkspaceMember, depth: number) {
    const kids = childrenByParent.get(member.id) ?? [];
    const leaves = fileLeaves.get(member.id) ?? [];
    const childCount = kids.length > 0 ? kids.length : leaves.filter((l) => l.kind !== "more").length;
    rows.push({ type: "member", id: member.id, member, depth, hasChildren: childCount > 0, childCount });
    if (!expandedIds.has(member.id)) return;
    if (kids.length > 0) {
      for (const k of [...kids].sort((a, b) => a.label.localeCompare(b.label))) walk(k, depth + 1);
    } else {
      for (const leaf of leaves) rows.push({ type: "file", id: leaf.id, parentId: member.id, depth: depth + 1, leaf });
    }
  }
  for (const r of roots) walk(r, 0);
  return rows;
}

function TreeRowView({
  row,
  touched,
  actorNames,
  touchedFileCount,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  row: TreeRow;
  touched: boolean;
  actorNames: string[];
  touchedFileCount: number;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const indent = { paddingLeft: `${row.depth * 1.25 + 0.6}rem` };

  if (row.type === "file") {
    if (row.leaf.kind === "more") {
      return (
        <div className="ws-tree-row ws-tree-row-file ws-tree-row-more" style={indent}>
          <span className="ws-tree-caret-spacer" />
          +{row.leaf.moreCount} more
        </div>
      );
    }
    return (
      <div className={`ws-tree-row ws-tree-row-file ws-tree-row-file-${row.leaf.kind}`} style={indent}>
        <span className="ws-tree-caret-spacer" />
        <span className="ws-tree-file-name">{basename(row.leaf.filePath)}</span>
        <span className="ws-tree-file-kind">{row.leaf.kind}</span>
      </div>
    );
  }

  const { member, hasChildren, childCount } = row;
  return (
    <div
      className={`ws-tree-row ws-tree-row-member${selected ? " ws-tree-row-selected" : ""}${touched ? " ws-tree-row-touched" : ""}`}
      style={indent}
      onClick={onSelect}
    >
      {hasChildren ? (
        <button
          type="button"
          className="ws-tree-caret"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="ws-tree-caret-spacer" />
      )}
      <span className="ws-tree-member-label">{member.label}</span>
      <span className="ws-tree-member-kind">{member.kind}</span>
      {hasChildren && <span className="ws-tree-chip ws-tree-chip-children">{childCount}</span>}
      {member.dependsOn.length > 0 && <span className="ws-tree-chip ws-tree-chip-deps">deps {member.dependsOn.length}</span>}
      {touched && (
        <span className="ws-tree-chip ws-tree-chip-touched">
          {touchedFileCount} file{touchedFileCount === 1 ? "" : "s"}{actorNames.length > 0 ? ` · ${actorNames.join(", ")}` : ""}
        </span>
      )}
    </div>
  );
}

export function WorkspaceMapPanel({ sessionId }: { sessionId: string | null }) {
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  const [activity, setActivity] = useState<WorkspaceActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Progressive disclosure: which members are toggled open. Starts empty
  // (every root collapsed) so the tree begins high-level; auto-expanding
  // ancestors of real session activity is handled by a separate effect
  // below rather than computed here, so a user's own manual
  // expand/collapse choices aren't clobbered on every activity refetch.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWorkspaceGraph().then(setGraph).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setActivity(null);
      return;
    }
    fetchWorkspaceActivity(sessionId).then(setActivity).catch(() => setActivity(null));
  }, [sessionId]);

  const touchByMember = useMemo(() => new Map((activity?.touches ?? []).map((t) => [t.memberId, t] as const)), [activity]);

  // Auto-expand the path down to whatever this session actually touched,
  // once per graph+activity pair, so real activity is never hidden behind
  // a collapsed row by default -- merges into whatever the user has
  // already expanded/collapsed by hand instead of overwriting it.
  useEffect(() => {
    if (!graph || touchByMember.size === 0) return;
    const toExpand = ancestorsOfTouched(graph, touchByMember.keys());
    if (toExpand.size === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of toExpand) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [graph, touchByMember]);

  const { childrenByParent, fileLeaves } = useMemo(
    () => (graph ? computeChildren(graph, touchByMember) : { childrenByParent: new Map(), fileLeaves: new Map() }),
    [graph, touchByMember],
  );

  const rows = useMemo(
    () => (graph ? buildVisibleRows(graph, childrenByParent, fileLeaves, expandedIds) : []),
    [graph, childrenByParent, fileLeaves, expandedIds],
  );

  const selectedMember = graph?.members.find((m) => m.id === selectedId) ?? null;
  const selectedTouch = selectedId ? touchByMember.get(selectedId) : undefined;
  const selectedLinksOut = (activity?.links ?? []).filter((l) => l.from === selectedId);
  const selectedLinksIn = (activity?.links ?? []).filter((l) => l.to === selectedId);
  const selectedChildren = selectedId ? graph?.members.filter((m) => m.parentId === selectedId) ?? [] : [];
  // Every other member touched this session, besides the selected one --
  // co-occurrence only, shown as plain text, never implying either caused
  // the other (that claim is only ever made by a real workspace.linked
  // event, surfaced separately below as "required change"/"required by").
  const selectedCoTouched = selectedId
    ? [...touchByMember.keys()].filter((id) => id !== selectedId).map((id) => graph?.members.find((m) => m.id === id)?.label ?? id)
    : [];

  if (error) {
    return <div className="inspector-empty">Could not load the workspace graph: {error}</div>;
  }
  if (!graph) {
    return <div className="inspector-empty">Loading workspace graph…</div>;
  }
  if (graph.members.length === 0) {
    return <div className="inspector-empty">No members were found -- {SOURCE_LABEL[graph.source]}.</div>;
  }

  return (
    <div className="ws-map-layout">
      <div className="ws-map-tree panel">
        <p className="ws-source-note">Source: {SOURCE_LABEL[graph.source]}</p>
        {!sessionId && <p className="microcopy" style={{ marginBottom: "0.5rem" }}>Pick a live, replay, or demo trace to see session activity overlaid.</p>}
        <div className="ws-tree">
          {rows.map((row) => {
            const touch = row.type === "member" ? touchByMember.get(row.member.id) : undefined;
            const touchedFileCount = touch ? touch.filesRead.length + touch.filesWritten.length + touch.filesSearched.length : 0;
            return (
              <TreeRowView
                key={row.id}
                row={row}
                touched={!!touch}
                actorNames={(touch?.actors ?? []).map((a) => a.name ?? a.id)}
                touchedFileCount={touchedFileCount}
                expanded={row.type === "member" && expandedIds.has(row.member.id)}
                selected={row.type === "member" && row.member.id === selectedId}
                onToggle={() => {
                  if (row.type !== "member") return;
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.member.id)) next.delete(row.member.id);
                    else next.add(row.member.id);
                    return next;
                  });
                }}
                onSelect={() => {
                  if (row.type === "member") setSelectedId(row.member.id);
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="panel ws-map-side">
        <p className="panel-title">Workspace</p>
        {selectedMember ? (
          <div className="ws-selected-detail">
            <p className="inspector-field">
              <span className="inspector-label">Member</span>
              <span className="inspector-value">{selectedMember.label}</span>
            </p>
            <p className="inspector-field">
              <span className="inspector-label">Kind</span>
              <span className="inspector-value">{selectedMember.kind}</span>
            </p>
            <p className="inspector-field">
              <span className="inspector-label">Path</span>
              <span className="inspector-value">{selectedMember.path}</span>
            </p>
            {selectedMember.description && (
              <p className="inspector-field">
                <span className="inspector-label">Description</span>
                <span className="inspector-value">{selectedMember.description}</span>
              </p>
            )}
            {selectedMember.dependsOn.length > 0 && (
              <p className="inspector-field">
                <span className="inspector-label">Depends on</span>
                <span className="inspector-value">{selectedMember.dependsOn.join(", ")}</span>
              </p>
            )}
            {selectedChildren.length > 0 && (
              <p className="inspector-field">
                <span className="inspector-label">Contains</span>
                <span className="inspector-value">{selectedChildren.map((c) => c.label).join(", ")}</span>
              </p>
            )}

            {selectedTouch ? (
              <>
                <p className="panel-title" style={{ marginTop: "0.75rem" }}>This session</p>
                {selectedTouch.filesWritten.length > 0 && (
                  <p className="inspector-field">
                    <span className="inspector-label">Written ({selectedTouch.filesWritten.length})</span>
                    <span className="inspector-value ws-file-list">{selectedTouch.filesWritten.join("\n")}</span>
                  </p>
                )}
                {selectedTouch.filesRead.length > 0 && (
                  <p className="inspector-field">
                    <span className="inspector-label">Read ({selectedTouch.filesRead.length})</span>
                    <span className="inspector-value ws-file-list">{selectedTouch.filesRead.join("\n")}</span>
                  </p>
                )}
              </>
            ) : (
              sessionId && <p className="microcopy" style={{ marginTop: "0.75rem" }}>Not touched this session.</p>
            )}

            {selectedCoTouched.length > 0 && (
              <p className="inspector-field">
                <span className="inspector-label">Also touched this session (co-occurrence only)</span>
                <span className="inspector-value">{selectedCoTouched.join(", ")}</span>
              </p>
            )}

            {selectedLinksOut.map((l) => (
              <p className="ws-link-note" key={l.eventId}>
                → required change in <strong>{l.to}</strong>{l.actor?.name ? ` (${l.actor.name})` : ""}: {l.reason}
              </p>
            ))}
            {selectedLinksIn.map((l) => (
              <p className="ws-link-note" key={l.eventId}>
                ← required by change in <strong>{l.from}</strong>{l.actor?.name ? ` (${l.actor.name})` : ""}: {l.reason}
              </p>
            ))}
          </div>
        ) : (
          <p className="microcopy" style={{ marginTop: "0.5rem" }}>Click a member to see details.</p>
        )}
      </div>
    </div>
  );
}
