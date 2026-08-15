// Live-computed activity breakdown for the current event set: which
// agents/subagents acted, which Skills were touched, which tools were
// called, and which files were read/written/searched. Every number here is
// derived directly from real events — this is the "tools view" / "files
// view" / "Skills view" / "agents view" required by the charter, backed by
// observation rather than a static list.
import type { AgentariumEvent } from "../../shared/events.js";

interface Tally {
  label: string;
  count: number;
}

function tally(events: AgentariumEvent[], predicate: (e: AgentariumEvent) => string | undefined): Tally[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = predicate(event);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function metaString(event: AgentariumEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

export function ActivityPanel({ events }: { events: AgentariumEvent[] }) {
  const agents = tally(events, (e) => (e.type === "agent.started" || e.type === "subagent.started" ? e.actor?.name ?? e.actor?.id : undefined));
  const skills = tally(events, (e) => (e.type.startsWith("skill.") ? metaString(e, "skill") : undefined));
  const tools = tally(events, (e) => (e.type === "tool.completed" || e.type === "mcp.tool.called" ? metaString(e, "tool") : undefined));
  const files = tally(events, (e) => (e.type === "file.read" || e.type === "file.written" || e.type === "file.searched" ? metaString(e, "path") : undefined));

  return (
    <div>
      <p className="panel-title">Agents</p>
      <ActivityList items={agents} empty="No additional specialists have been summoned." />
      <p className="panel-title">Skills</p>
      <ActivityList items={skills} empty="All specialist manuals remain closed." />
      <p className="panel-title">Tools</p>
      <ActivityList items={tools} empty="Nothing is thinking where we can see it." />
      <p className="panel-title">Files</p>
      <ActivityList items={files} empty="No files touched yet." />
    </div>
  );
}

function ActivityList({ items, empty }: { items: Tally[]; empty: string }) {
  if (items.length === 0) return <p className="microcopy" style={{ fontSize: "0.7rem" }}>{empty}</p>;
  return (
    <ul className="activity-list">
      {items.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <span>{item.count}</span>
        </li>
      ))}
    </ul>
  );
}
