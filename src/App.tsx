import { useEffect, useMemo, useState } from "react";
import type { AgentariumEvent } from "../shared/events.js";
import { useEventStream } from "./api/useEventStream.js";
import {
  fetchDemoEvents,
  fetchDemoTraces,
  fetchSessionEvents,
  fetchSessions,
  updateSession,
  type SessionSummary,
} from "./api/client.js";
import { EventGraph } from "./graph/EventGraph.js";
import { Timeline } from "./timeline/Timeline.js";
import { Inspector } from "./inspector/Inspector.js";
import { ActivityPanel } from "./panels/ActivityPanel.js";
import { RepositoryPanel } from "./panels/RepositoryPanel.js";
import { ComparePanel } from "./panels/ComparePanel.js";
import { WorldMapPanel } from "./panels/WorldMapPanel.js";
import { StoryView } from "./story/StoryView.js";
import { StoryboardView } from "./storyboard/StoryboardView.js";
import { BookNarrationView } from "./narrative/BookNarrationView.js";

// "story"/"storyboard"/"book" are all real-telemetry-derived views with no
// picker of their own.
type Mode = "live" | "replay" | "demo" | "story" | "storyboard" | "book" | "world" | "repository" | "compare";

export default function App() {
  const [mode, setMode] = useState<Mode>("live");
  const [selectedEvent, setSelectedEvent] = useState<AgentariumEvent | null>(null);

  const live = useEventStream();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [replayEvents, setReplayEvents] = useState<AgentariumEvent[]>([]);
  const [replayCursor, setReplayCursor] = useState(100);

  function refreshSessions() {
    fetchSessions().then(setSessions).catch(() => setSessions([]));
  }

  function saveSession(id: string) {
    updateSession(id, { saved: true }).then((updated) =>
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s))),
    );
  }

  function renameSession(id: string, label: string) {
    updateSession(id, { label }).then((updated) =>
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s))),
    );
  }

  const [demoTraces, setDemoTraces] = useState<string[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [demoEvents, setDemoEvents] = useState<AgentariumEvent[]>([]);

  useEffect(() => {
    if (mode === "replay") refreshSessions();
    if (mode === "demo") fetchDemoTraces().then(setDemoTraces).catch(() => setDemoTraces([]));
  }, [mode]);

  useEffect(() => {
    if (selectedSession) fetchSessionEvents(selectedSession).then(setReplayEvents).catch(() => setReplayEvents([]));
  }, [selectedSession]);

  useEffect(() => {
    if (selectedDemo) fetchDemoEvents(selectedDemo).then(setDemoEvents).catch(() => setDemoEvents([]));
  }, [selectedDemo]);

  const visibleEvents = useMemo(() => {
    if (mode === "live") return live.events;
    if (mode === "replay") {
      const cutIndex = Math.floor((replayCursor / 100) * replayEvents.length);
      return replayEvents.slice(0, Math.max(cutIndex, replayEvents.length > 0 ? 1 : 0));
    }
    if (mode === "demo") return demoEvents;
    if (mode === "story" || mode === "storyboard" || mode === "book") {
      // These modes have no picker of their own -- they show the real
      // telemetry of whichever trace is otherwise selected (a demo trace, a
      // replay session, or the live stream), so switching to one never goes
      // blank just because it isn't a data source itself.
      if (selectedDemo) return demoEvents;
      if (selectedSession) return replayEvents;
      return live.events;
    }
    return [];
  }, [mode, live.events, replayEvents, replayCursor, demoEvents, selectedDemo, selectedSession]);

  // Storyboard/Book are stored per real session id (see
  // shared/narrative-store.ts), so they need a concrete session to key off
  // of -- the first visible event's sessionId, matching whichever data
  // source is otherwise in view.
  const effectiveSessionId = useMemo(() => visibleEvents[0]?.sessionId ?? null, [visibleEvents]);

  const isDemo = mode === "demo";

  return (
    <div className="app">
      {isDemo && <div className="demo-banner">Replaying a previously documented incident.</div>}

      <header className="app-header">
        <div>
          <div className="app-title">AGENTARIUM</div>
          <div className="app-subtitle">Glass-box observability for agentic AI</div>
        </div>
        <div className="mode-tabs">
          {(
            ["live", "replay", "demo", "story", "storyboard", "book", "world", "repository", "compare"] as Mode[]
          ).map((m) => (
            <button key={m} className={`mode-tab${mode === m ? " active" : ""}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </header>

      {mode === "repository" ? (
        <RepositoryPanel />
      ) : mode === "compare" ? (
        <ComparePanel />
      ) : mode === "world" ? (
        <WorldMapPanel />
      ) : mode === "story" ? (
        <StoryView events={visibleEvents} />
      ) : mode === "storyboard" ? (
        <StoryboardView events={visibleEvents} sessionId={effectiveSessionId} />
      ) : mode === "book" ? (
        <BookNarrationView sessionId={effectiveSessionId} />
      ) : (
        <div className="app-body">
          <div className="panel">
            {mode === "replay" && (
              <>
                <p className="panel-title">Sessions</p>
                {sessions.length === 0 && <p className="microcopy" style={{ fontSize: "0.72rem" }}>No sessions recorded yet.</p>}
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`session-item${s.id === selectedSession ? " active" : ""}`}
                    onClick={() => setSelectedSession(s.id)}
                  >
                    <span className="session-item-row">
                      <span
                        className={`session-star${s.saved ? " session-star-saved" : ""}`}
                        title={s.saved ? "Saved run" : "Save this run"}
                        onClick={(e) => {
                          e.stopPropagation();
                          saveSession(s.id);
                        }}
                      >
                        {s.saved ? "★" : "☆"}
                      </span>
                      <span
                        className="session-label"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          const next = window.prompt("Label this run", s.label ?? s.id);
                          if (next !== null) renameSession(s.id, next);
                        }}
                      >
                        {s.label ?? s.id}
                      </span>
                    </span>
                  </div>
                ))}
              </>
            )}
            {mode === "demo" && (
              <>
                <p className="panel-title">Demo traces</p>
                {demoTraces.length === 0 && <p className="microcopy" style={{ fontSize: "0.72rem" }}>No demo traces found.</p>}
                {demoTraces.map((name) => (
                  <div
                    key={name}
                    className={`session-item${name === selectedDemo ? " active" : ""}`}
                    onClick={() => setSelectedDemo(name)}
                  >
                    {name}
                  </div>
                ))}
              </>
            )}
            <div style={{ marginTop: mode === "live" ? 0 : "1rem" }}>
              <ActivityPanel events={visibleEvents} />
            </div>
          </div>

          <div className="center-panel">
            <div className="graph-panel">
              <EventGraph events={visibleEvents} onSelectEvent={setSelectedEvent} />
            </div>
            <div className="timeline-panel">
              <Timeline events={visibleEvents} selectedId={selectedEvent?.id ?? null} onSelect={setSelectedEvent} />
            </div>
          </div>

          <div className="panel">
            <p className="panel-title">Inspector</p>
            <Inspector event={selectedEvent} />
          </div>
        </div>
      )}

      {mode === "replay" && selectedSession && (
        <div className="replay-controls">
          <span>replay</span>
          <input
            type="range"
            min={0}
            max={100}
            value={replayCursor}
            onChange={(e) => setReplayCursor(Number(e.target.value))}
          />
          <span>
            {visibleEvents.length}/{replayEvents.length} events
          </span>
        </div>
      )}

      <footer className="app-footer">
        <span>
          <span className={`status-light${mode === "live" ? (live.connected ? " live" : " down") : ""}`} />
          {mode === "live" ? (live.connected ? "live stream connected" : "disconnected") : mode}
        </span>
        <span className="microcopy">
          {mode === "world"
            ? "The world persists on disk, independent of this dashboard."
            : visibleEvents.length === 0
              ? "No events yet."
              : `${visibleEvents.length} events observed.`}
        </span>
      </footer>
    </div>
  );
}
