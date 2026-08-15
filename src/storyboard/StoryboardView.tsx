// Generic "Storyboard" mode: cross-references the real StoryBeat tree
// (shared/story.ts, built from whatever events are currently in view --
// live/replay/demo, same as Story mode) against the agent-authored
// Storyboard persisted for that session (.agentarium/storyboards/<id>.json,
// see shared/narrative-types.ts and .github/skills/event-storyboard).
// Deliberately independent of src/book/BookView.tsx, which reads this
// repo's own world/<agent>_actions fiction ledger.
import { useEffect, useMemo, useState } from "react";
import type { AgentariumEvent } from "../../shared/events.js";
import { buildStoryGraph } from "../../shared/story.js";
import type { Storyboard } from "../../shared/narrative-types.js";
import { fetchStoryboard } from "../api/client.js";

export function StoryboardView({ events, sessionId }: { events: AgentariumEvent[]; sessionId: string | null }) {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const graph = useMemo(() => buildStoryGraph(events), [events]);
  const realBeats = useMemo(() => [...graph.beats.values()].filter((b) => b.id !== graph.rootId), [graph]);
  const byBeatId = useMemo(
    () => new Map((storyboard?.beats ?? []).map((b) => [b.beatId, b] as const)),
    [storyboard],
  );

  useEffect(() => {
    setError(null);
    if (!sessionId) {
      setStoryboard(null);
      return;
    }
    fetchStoryboard(sessionId)
      .then(setStoryboard)
      .catch((err) => setError(String(err)));
  }, [sessionId]);

  if (!sessionId) {
    return <div className="inspector-empty">No session in view yet -- pick a live, replay, or demo trace first.</div>;
  }
  if (error) {
    return <div className="inspector-empty">Could not load the storyboard: {error}</div>;
  }
  if (realBeats.length === 0) {
    return <div className="inspector-empty">No story beats yet -- nothing has happened in this session.</div>;
  }

  return (
    <div className="panel" style={{ maxWidth: 900, margin: "0 auto", overflowY: "auto" }}>
      <p className="panel-title">Storyboard — session {sessionId}</p>
      {!storyboard && (
        <p className="microcopy" style={{ marginBottom: "1rem" }}>
          No agent-authored storyboard exists yet for this session. Ask the coding agent to run the
          event-storyboard Skill against this session's events to populate one.
        </p>
      )}
      {realBeats.map((beat) => {
        const entry = byBeatId.get(beat.id);
        return (
          <div key={beat.id} className="book-perspective-item" style={{ display: "block", cursor: "default", marginBottom: "0.75rem" }}>
            <div className="book-storyboard-flags">
              <span className="book-storyboard-flag">{beat.kind}</span>
              {beat.character && <span className="book-storyboard-flag">{beat.character}</span>}
              {beat.unresolved && <span className="book-storyboard-flag bloomrot-aware">unresolved</span>}
            </div>
            <p className="book-storyboard-desc" style={{ fontWeight: 600 }}>{beat.title}</p>
            {entry ? (
              <>
                <p className="book-storyboard-desc">{entry.description}</p>
                {entry.citedEventIds.length > 0 && (
                  <ul className="book-storyboard-citations">
                    {entry.citedEventIds.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="microcopy">Not yet storyboarded.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
