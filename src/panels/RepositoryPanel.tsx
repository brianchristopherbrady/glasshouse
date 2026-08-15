// Catalog of authored agents/skills/prompts, read live from the repo.
// Satisfies "agents view", "Skills view" (as authored artifacts, distinct
// from the Activity panel's live usage counts).
import { useEffect, useState } from "react";
import { fetchRepoAgents, fetchRepoPrompts, fetchRepoSkills, type RepoAgent, type RepoPrompt, type RepoSkill } from "../api/client.js";

export function RepositoryPanel() {
  const [agents, setAgents] = useState<RepoAgent[]>([]);
  const [skills, setSkills] = useState<RepoSkill[]>([]);
  const [prompts, setPrompts] = useState<RepoPrompt[]>([]);

  useEffect(() => {
    fetchRepoAgents().then(setAgents).catch(() => setAgents([]));
    fetchRepoSkills().then(setSkills).catch(() => setSkills([]));
    fetchRepoPrompts().then(setPrompts).catch(() => setPrompts([]));
  }, []);

  return (
    <div style={{ padding: "1rem 1.5rem", overflowY: "auto" }}>
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
