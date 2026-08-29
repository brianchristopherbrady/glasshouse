// Catalog of authored agents/skills/prompts, plus the repo's real
// high-level members (see shared/workspace-types.ts), read live from the
// repo. Satisfies "agents view", "Skills view" (as authored artifacts,
// distinct from the Activity panel's live usage counts) and "members view"
// (the same data the Workspace Map draws, shown here as a flat catalog with
// declared hierarchy indicated by indentation).
import { useEffect, useState } from "react";
import {
  fetchRepoAgents,
  fetchRepoPrompts,
  fetchRepoSkills,
  fetchWorkspaceGraph,
  type RepoAgent,
  type RepoPrompt,
  type RepoSkill,
} from "../api/client.js";
import type { WorkspaceGraph, WorkspaceMember } from "../../../core/shared/workspace-types.js";

const MEMBER_SOURCE_LABEL: Record<WorkspaceGraph["source"], string> = {
  config: "explicitly mapped",
  "package-manager": "package-manager workspaces",
  "folder-heuristic": "top-level folders (unmapped)",
};

/** Depth-first, parents before their declared children, so hierarchy reads
 * top-to-bottom without needing a real tree layout for this flat list view. */
function orderMembersByHierarchy(members: WorkspaceMember[]): { member: WorkspaceMember; depth: number }[] {
  const byParent = new Map<string | undefined, WorkspaceMember[]>();
  for (const m of members) {
    const key = m.parentId;
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(m);
  }
  const result: { member: WorkspaceMember; depth: number }[] = [];
  function walk(parentId: string | undefined, depth: number) {
    for (const m of byParent.get(parentId) ?? []) {
      result.push({ member: m, depth });
      walk(m.id, depth + 1);
    }
  }
  walk(undefined, 0);
  return result;
}

export function RepositoryPanel() {
  const [agents, setAgents] = useState<RepoAgent[]>([]);
  const [skills, setSkills] = useState<RepoSkill[]>([]);
  const [prompts, setPrompts] = useState<RepoPrompt[]>([]);
  const [workspaceGraph, setWorkspaceGraph] = useState<WorkspaceGraph | null>(null);

  useEffect(() => {
    fetchRepoAgents().then(setAgents).catch(() => setAgents([]));
    fetchRepoSkills().then(setSkills).catch(() => setSkills([]));
    fetchRepoPrompts().then(setPrompts).catch(() => setPrompts([]));
    fetchWorkspaceGraph().then(setWorkspaceGraph).catch(() => setWorkspaceGraph(null));
  }, []);

  const orderedMembers = workspaceGraph ? orderMembersByHierarchy(workspaceGraph.members) : [];

  return (
    <div style={{ padding: "1rem 1.5rem", overflowY: "auto" }}>
      <section className="repo-section">
        <p className="panel-title">
          Members ({orderedMembers.length}){workspaceGraph && <span className="repo-source-tag"> · {MEMBER_SOURCE_LABEL[workspaceGraph.source]}</span>}
        </p>
        {orderedMembers.map(({ member, depth }) => (
          <div className="repo-item" key={member.id} style={{ paddingLeft: `${depth * 1.1}rem` }}>
            <span className="repo-item-name">{member.label}</span>
            <span className="repo-item-desc">
              {member.kind} · {member.path}
              {member.description ? ` — ${member.description}` : ""}
            </span>
          </div>
        ))}
        {orderedMembers.length === 0 && <p className="microcopy">No members discovered yet.</p>}
      </section>
      <section className="repo-section">
        <p className="panel-title">Agents ({agents.length})</p>
        {agents.map((a) => (
          <div className="repo-item" key={a.file}>
            <span className="repo-item-name">{a.name}</span>
            {a.description && <span className="repo-item-desc">{a.description}</span>}
          </div>
        ))}
      </section>
      <section className="repo-section">
        <p className="panel-title">Skills ({skills.length})</p>
        {skills.map((s) => (
          <div className="repo-item" key={s.dir}>
            <span className="repo-item-name">{s.name}</span>
            {s.description && <span className="repo-item-desc">{s.description}</span>}
          </div>
        ))}
        {skills.length === 0 && <p className="microcopy">All specialist manuals remain closed.</p>}
      </section>
      <section className="repo-section">
        <p className="panel-title">Prompts ({prompts.length})</p>
        {prompts.map((p) => (
          <div className="repo-item" key={p.file}>
            <span className="repo-item-name">{p.name}</span>
            {p.description && <span className="repo-item-desc">{p.description}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
