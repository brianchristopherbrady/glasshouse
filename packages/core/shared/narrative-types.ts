// Generic, repo-agnostic narrative layer: turns a session's real StoryBeats
// (shared/story.ts, built from real FlowbookEvents) into an agent-authored
// Storyboard. Keyed to real StoryBeat ids (shared/story.ts's
// `beat:<kind>:<id>`) so it works for any consuming repo. See
// .github/skills/event-storyboard for how an agent populates it.
import type { StoryBeatKind } from "./story.js";

/** One interpretation of a single real StoryBeat -- either mechanically
 * generated straight from the beat's own fields (`source: "auto"`, see
 * shared/auto-storyboard.ts, never invents anything beyond what the beat
 * already carries) or written by an agent via the event-storyboard Skill
 * (`source: "agent"`, a fuller account that may cite more context). Every
 * real session gets `"auto"` entries with zero setup; `"agent"` entries are
 * an optional enrichment layer that always wins when present. Never blur
 * the two in the UI -- same rule as `evidence` on FlowbookEvent. */
export interface NarrativeBeat {
  /** Matches a `StoryBeat.id` from shared/story.ts, e.g. "beat:decision:evt-1". */
  beatId: string;
  kind: StoryBeatKind;
  /** A real, specific description of what this beat was -- what happened,
   * grounded in the beat's own evidence/reason/next/effects. Not invented. */
  description: string;
  /** Actor ids/names who appear or are referenced in the description. */
  involves: string[];
  /** FlowbookEvent ids this description is grounded in -- the paper trail. */
  citedEventIds: string[];
  /** "auto" = mechanically derived, no agent involved; "agent" = written by
   * an agent via event-storyboard. Absent on storyboards persisted before
   * this field existed -- treat as "agent" (they were all Skill-authored). */
  source?: "auto" | "agent";
}

export interface Storyboard {
  sessionId: string;
  generatedAt: string;
  beats: NarrativeBeat[];
}
