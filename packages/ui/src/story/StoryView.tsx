// Standalone "Story" mode: the narrative tree, and nothing else cluttering
// it -- no raw tool-call graph, no full chronological timeline. Each beat is
// a character's decision (or an equivalent milestone: an agent taking up
// the case, a specialist being summoned, a validation outcome) and a
// decision can branch into several downstream beats at once, which is what
// makes this a real tree rather than a single chain. Clicking a beat opens
// the full narrative explanation -- justification, alternatives considered,
// declared next step, downstream effects, and any unresolved thread -- in
// the side panel. Kept as its own top-level mode (see App.tsx's Mode union)
// rather than replacing the existing live/replay/demo graph panel, so it
// doesn't collide with in-flight edits elsewhere in the graph/app code.
import { useMemo, useState } from "react";
import type { FlowbookEvent } from "../../../core/shared/events.js";
import { buildStoryGraph, type StoryBeat } from "../../../core/shared/story.js";
import { StoryGraph } from "./StoryGraph.js";
import { StoryPanel } from "./StoryPanel.js";
import { Inspector } from "../inspector/Inspector.js";

export function StoryView({ events }: { events: FlowbookEvent[] }) {
  const [selectedBeat, setSelectedBeat] = useState<StoryBeat | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FlowbookEvent | null>(null);

  const graph = useMemo(() => buildStoryGraph(events), [events]);

  return (
    <div className="story-layout">
      <div className="story-canvas">
        <StoryGraph
          graph={graph}
          onSelectBeat={(beat) => {
            setSelectedBeat(beat);
            setSelectedEvent(null);
          }}
        />
      </div>
      <div className="panel story-side">
        <p className="panel-title">Story</p>
        <StoryPanel
          beat={selectedBeat}
          graph={graph}
          onSelectEvent={(event) => setSelectedEvent(event)}
        />
        {selectedEvent && (
          <>
            <p className="panel-title" style={{ marginTop: "1rem" }}>
              Raw evidence
            </p>
            <Inspector event={selectedEvent} />
          </>
        )}
      </div>
    </div>
  );
}
