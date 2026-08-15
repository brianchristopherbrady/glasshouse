// Generic, repo-agnostic narrative layer: turns a session's real StoryBeats
// (shared/story.ts, built from real AgentariumEvents) into an agent-authored
// Storyboard, and then a styled Book narration. Deliberately independent of
// this repo's world/<agent>_actions fiction pipeline (world/storyboard.json,
// world/chapters/*.md) -- that pipeline is this repo's own content, keyed to
// chapter.thread.entry locators the fiction invented. This layer is keyed to
// real StoryBeat ids (shared/story.ts's `beat:<kind>:<id>`) so it works for
// any consuming repo, fictional or not. See .github/skills/event-storyboard
// and .github/skills/event-book for how an agent populates it.
import type { StoryBeatKind } from "./story.js";

/** One agent-authored interpretation of a single real StoryBeat. */
export interface NarrativeBeat {
  /** Matches a `StoryBeat.id` from shared/story.ts, e.g. "beat:decision:evt-1". */
  beatId: string;
  kind: StoryBeatKind;
  /** A real, specific description of what this beat was -- what happened,
   * grounded in the beat's own evidence/reason/next/effects. Not invented. */
  description: string;
  /** Actor ids/names who appear or are referenced in the description. */
  involves: string[];
  /** AgentariumEvent ids this description is grounded in -- the paper trail,
   * mirroring world/storyboard.json's citedSources convention. */
  citedEventIds: string[];
}

export interface Storyboard {
  sessionId: string;
  generatedAt: string;
  beats: NarrativeBeat[];
}

/** A consuming repo's narration style, read from agentarium.config.json at
 * the repo root. Absent config falls back to a plain technical-spec style
 * (see shared/narrative-store.ts's DEFAULT_NARRATION_CONFIG). */
export interface NarrationConfig {
  style: string;
  description?: string;
  /** Optional path (relative to repo root) to a voice/style guide the agent
   * should read before writing Book narration. */
  voiceGuide?: string;
  /** Optional path (relative to repo root) to a characters/roster file the
   * agent should read before writing Book narration, for repos (like this
   * one) whose style involves named recurring characters. */
  characters?: string;
}

/** One section of assembled Book prose, covering one or more beats in
 * sequence -- mirrors world/chapters/chapter-<N>.md's per-beat structure,
 * but keyed to real beat ids instead of invented locators. */
export interface BookSection {
  beatIds: string[];
  heading?: string;
  text: string;
}

export interface NarrativeBook {
  sessionId: string;
  style: string;
  title: string;
  generatedAt: string;
  sections: BookSection[];
}
