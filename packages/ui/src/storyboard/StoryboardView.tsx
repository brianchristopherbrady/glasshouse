// Generic "Storyboard" mode: a real, always-populated account of a
// session's agentic flow. Every beat gets an auto-generated entry the
// server derives mechanically from its own StoryBeat fields (no agent/LLM
// required -- see shared/auto-storyboard.ts), so a team sees a real
// storyboard the moment a session exists. If an agent has additionally run
// the event-storyboard Skill for this session, its richer per-beat prose
// replaces the auto entry (tagged "agent" instead of "auto") -- an
// optional enrichment layer, never the only path to content.
import { useEffect, useState } from "react";
import type { FlowbookEvent } from "../../../core/shared/events.js";
import type { Storyboard } from "../../../core/shared/narrative-types.js";
import { fetchStoryboard } from "../api/client.js";

export function StoryboardView({ events, sessionId }: { events: FlowbookEvent[]; sessionId: string | null }) {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    if (!sessionId) {
      setStoryboard(null);
      return;
    }
    setLoading(true);
    fetchStoryboard(sessionId)
      .then(setStoryboard)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [sessionId, events.length]);

  if (!sessionId) {
    return <div className="inspector-empty">No session in view yet -- pick a live, replay, or demo trace first.</div>;
  }
  if (error) {
    return <div className="inspector-empty">Could not load the storyboard: {error}</div>;
  }
  if (loading && !storyboard) {
    return <div className="inspector-empty">Loading storyboard…</div>;
  }
  if (!storyboard || storyboard.beats.length === 0) {
    return <div className="inspector-empty">No story beats yet -- nothing has happened in this session.</div>;
  }

  return (
    <div className="panel" style={{ maxWidth: 900, margin: "0 auto", overflowY: "auto" }}>
      <p className="panel-title">Storyboard — session {sessionId}</p>
      {storyboard.beats.map((entry) => (
        <div key={entry.beatId} className="storyboard-entry" style={{ marginBottom: "0.75rem" }}>
          <div className="storyboard-flags">
            <span className="storyboard-flag">{entry.kind}</span>
            {entry.involves.map((who) => (
              <span key={who} className="storyboard-flag">{who}</span>
            ))}
            <span className={`storyboard-flag storyboard-source-${entry.source ?? "agent"}`}>
              {entry.source === "agent" ? "agent-authored" : "auto"}
            </span>
          </div>
          <p className="storyboard-desc">{entry.description}</p>
          {entry.citedEventIds.length > 0 && (
            <ul className="storyboard-citations">
              {entry.citedEventIds.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
