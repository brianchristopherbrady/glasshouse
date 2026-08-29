// Full narrative detail for a selected story beat: what happened, why (the
// declared justification, if any -- never invented), what it caused
// downstream, and whether any thread it opened was left unresolved. This is
// the "click a node -> full explanation" panel; StoryGraph itself only
// shows the shape of the story, not this depth of detail.
import type { FlowbookEvent } from "../../../core/shared/events.js";
import { narrate } from "../../../core/shared/narrate.js";
import { ancestorsOf, type StoryBeat, type StoryGraph } from "../../../core/shared/story.js";

const EVIDENCE_EXPLANATION: Record<FlowbookEvent["evidence"], string> = {
  observed: "Directly observed by a hook, the MCP server, or the filesystem.",
  declared: "Self-reported by the agent. Not independently verified.",
  inferred: "Guessed from indirect signals. Treat with skepticism.",
};

export function StoryPanel({
  beat,
  graph,
  onSelectEvent,
}: {
  beat: StoryBeat | null;
  graph: StoryGraph | null;
  onSelectEvent?: (event: FlowbookEvent) => void;
}) {
  if (!beat) {
    return <div className="inspector-empty">Click a beat in the story to read its full explanation.</div>;
  }

  // Collapse consecutive ancestors that share the same displayed label (e.g.
  // an agent beat immediately followed by that same agent's decision beat)
  // -- both are real, distinct beats, but showing the name twice in a row
  // is just visual noise in a breadcrumb.
  const rawTrail = graph ? ancestorsOf(graph, beat.id).reverse() : [];
  const trail = rawTrail.filter((ancestor, i) => i === 0 || (ancestor.character ?? ancestor.title) !== (rawTrail[i - 1]!.character ?? rawTrail[i - 1]!.title));

  return (
    <div className="story-panel">
      {trail.length > 0 && (
        <div className="story-breadcrumb">
          {trail.map((ancestor, i) => (
            <span key={ancestor.id}>
              {i > 0 && <span className="story-breadcrumb-sep"> / </span>}
              {ancestor.character ?? ancestor.title}
            </span>
          ))}
        </div>
      )}

      <div className="inspector-field">
        <span className="inspector-label">What happened</span>
        <span className="inspector-value inspector-story">{beat.title}</span>
      </div>

      {beat.character && (
        <div className="inspector-field">
          <span className="inspector-label">Character</span>
          <span className="inspector-value">{beat.character}</span>
        </div>
      )}

      {beat.fromAgent && beat.toAgent && (
        <div className="inspector-field">
          <span className="inspector-label">Handoff</span>
          <span className="inspector-value">{beat.fromAgent} → {beat.toAgent}</span>
        </div>
      )}

      {beat.reason && (
        <div className="inspector-field">
          <span className="inspector-label">Justification (self-reported)</span>
          <span className="inspector-value">{beat.reason}</span>
        </div>
      )}

      {beat.alternatives && beat.alternatives.length > 0 && (
        <div className="inspector-field">
          <span className="inspector-label">Alternatives considered</span>
          <ul className="story-list">
            {beat.alternatives.map((alt) => (
              <li key={alt}>{alt}</li>
            ))}
          </ul>
        </div>
      )}

      {beat.confidence !== undefined && (
        <div className="inspector-field">
          <span className="inspector-label">Declared confidence</span>
          <span className="inspector-value">{Math.round(beat.confidence * 100)}%</span>
        </div>
      )}

      {beat.next && (
        <div className="inspector-field">
          <span className="inspector-label">Declared next step</span>
          <span className="inspector-value">{beat.next}</span>
        </div>
      )}

      <div className="inspector-field">
        <span className="inspector-label">Evidence: {beat.evidence}</span>
        <span className="inspector-value">{EVIDENCE_EXPLANATION[beat.evidence]}</span>
      </div>

      {beat.unresolved && (
        <div className="story-unresolved-banner">
          Unresolved thread: {beat.unresolvedReason}
        </div>
      )}

      <div className="inspector-field">
        <span className="inspector-label">
          Downstream effects {beat.effects.length > 0 ? `(${beat.effects.length})` : ""}
        </span>
        {beat.effects.length === 0 ? (
          <span className="inspector-value">No further activity was observed under this beat.</span>
        ) : (
          <ul className="story-effect-list">
            {beat.effects.map((event) => (
              <li key={event.id} onClick={() => onSelectEvent?.(event)}>
                <span className="timeline-time">{event.timestamp.slice(11, 19)}</span>
                <span>{narrate(event)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {beat.childIds.length > 1 && (
        <div className="inspector-field">
          <span className="inspector-label">Branched into {beat.childIds.length} downstream lines</span>
        </div>
      )}
    </div>
  );
}
