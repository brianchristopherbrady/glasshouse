// Chronological, narrated event list with provenance badges. Clicking a
// row selects it for the Inspector panel.
import type { AgentariumEvent } from "../../shared/events.js";
import { narrate } from "../../shared/narrate.js";

function badgeClass(event: AgentariumEvent): string {
  if (event.source === "demo") return "badge badge-demo";
  if (event.type.endsWith(".failed")) return "badge badge-fail";
  return `badge badge-${event.evidence}`;
}

function badgeText(event: AgentariumEvent): string {
  if (event.source === "demo") return "demo";
  return event.evidence;
}

export function Timeline({
  events,
  selectedId,
  onSelect,
}: {
  events: AgentariumEvent[];
  selectedId: string | null;
  onSelect: (event: AgentariumEvent) => void;
}) {
  if (events.length === 0) {
    return <div className="inspector-empty">No events yet.</div>;
  }

  return (
    <div>
      {events.map((event) => (
        <div
          key={event.id}
          className={`timeline-row${event.id === selectedId ? " selected" : ""}`}
          onClick={() => onSelect(event)}
        >
          <span className="timeline-time">{event.timestamp.slice(11, 19)}</span>
          <span className="timeline-type">{event.type}</span>
          <span className="timeline-narration">{narrate(event)}</span>
          <span className={badgeClass(event)}>{badgeText(event)}</span>
        </div>
      ))}
    </div>
  );
}
