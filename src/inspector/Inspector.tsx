// Raw event evidence inspector. Charter requirement: "raw event evidence is
// inspectable" — this shows the full normalized event plus an honest
// explanation of what its provenance fields mean, never a paraphrase that
// hides the distinction between observed/declared/inferred/demo.
import type { AgentariumEvent } from "../../shared/events.js";
import { narrate } from "../../shared/narrate.js";

const EVIDENCE_EXPLANATION: Record<AgentariumEvent["evidence"], string> = {
  observed: "Directly observed by a hook, the MCP server, or the filesystem.",
  declared: "Self-reported by the agent (e.g. a declared decision). Not independently verified.",
  inferred: "Guessed from indirect signals. Treat with skepticism.",
};

export function Inspector({ event }: { event: AgentariumEvent | null }) {
  if (!event) {
    return <div className="inspector-empty">Nothing selected. Choose an event from the timeline or graph.</div>;
  }

  return (
    <div>
      <div className="inspector-field">
        <span className="inspector-label">Story</span>
        <span className="inspector-value inspector-story">{narrate(event)}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Type</span>
        <span className="inspector-value">{event.type}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Label</span>
        <span className="inspector-value">{event.label}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Timestamp</span>
        <span className="inspector-value">{event.timestamp}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Actor</span>
        <span className="inspector-value">
          {event.actor ? `${event.actor.kind}${event.actor.name ? ` · ${event.actor.name}` : ""} (${event.actor.id})` : "—"}
        </span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Source</span>
        <span className="inspector-value">{event.source}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Evidence: {event.evidence}</span>
        <span className="inspector-value">{EVIDENCE_EXPLANATION[event.evidence]}</span>
      </div>
      <div className="inspector-field">
        <span className="inspector-label">Raw event</span>
        <pre className="raw-json">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  );
}
