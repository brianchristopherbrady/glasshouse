// Deterministic, no-LLM storyboard generation: turns a session's real
// StoryGraph (shared/story.ts) into a full Storyboard automatically, with
// zero agent involvement required. This is what makes Storyboard mode
// actually useful out of the box -- a team opens the dashboard and sees a
// real account of what every agentic flow did, not an empty "not yet
// storyboarded" wall waiting on someone to remember to run a Skill.
// Every sentence here is assembled purely from fields the beat already
// carries (title/reason/next/character/effects/unresolvedReason) -- same
// no-invention rule as shared/narrate.ts and shared/metrics.ts. The
// agent-authored event-storyboard Skill remains a richer, optional
// enrichment layer on top (see mergeStoryboards below): its entries always
// win over an auto entry for the same beat, but every beat gets *something*
// the moment it exists.
import { narrate } from "./narrate.js";
import type { StoryBeat, StoryGraph } from "./story.js";
import type { NarrativeBeat, Storyboard } from "./narrative-types.js";

function involvesOf(beat: StoryBeat): string[] {
  const ids = new Set<string>();
  if (beat.character) ids.add(beat.character);
  if (beat.fromAgent) ids.add(beat.fromAgent);
  if (beat.toAgent) ids.add(beat.toAgent);
  for (const effect of beat.effects) {
    const name = effect.actor?.name ?? effect.actor?.id;
    if (name) ids.add(name);
  }
  return [...ids];
}

function citedEventIdsOf(beat: StoryBeat): string[] {
  const ids: string[] = [];
  if (beat.sourceEvent) ids.push(beat.sourceEvent.id);
  return ids;
}

/** One plain, honest sentence (or two) describing a beat, built only from
 * fields already on it -- no LLM, no invention, thin beats get thin
 * descriptions. Mirrors the register `shared/narrate.ts` uses for
 * individual events, extended with the extra fields a StoryBeat carries
 * (reason/next/alternatives/confidence/unresolvedReason) that a single
 * event's narration doesn't have. */
export function describeBeat(beat: StoryBeat): string {
  const parts: string[] = [beat.title];

  if (beat.kind === "decision" && beat.reason) {
    parts.push(`Reason: ${beat.reason}.`);
  } else if (beat.kind === "handoff" && beat.reason) {
    parts.push(`Reason: ${beat.reason}.`);
  }

  if (beat.alternatives && beat.alternatives.length > 0) {
    parts.push(`Alternatives considered: ${beat.alternatives.join("; ")}.`);
  }

  if (beat.confidence !== undefined) {
    parts.push(`Declared confidence: ${Math.round(beat.confidence * 100)}%.`);
  }

  if (beat.next) {
    parts.push(`Declared next step: ${beat.next}.`);
  }

  if (beat.effects.length > 0) {
    const sample = beat.effects.slice(0, 3).map((e) => narrate(e));
    const suffix = beat.effects.length > 3 ? ` (+${beat.effects.length - 3} more)` : "";
    parts.push(`Downstream: ${sample.join(" ")}${suffix}`);
  }

  if (beat.unresolved && beat.unresolvedReason) {
    parts.push(`Unresolved: ${beat.unresolvedReason}`);
  }

  return parts.join(" ");
}

/** Builds a complete Storyboard for a session mechanically from its
 * StoryGraph -- every non-root beat becomes one `NarrativeBeat` with
 * `source: "auto"`. Requires no agent, no Skill invocation, and no network
 * call; this is pure reduction over already-observed/declared events,
 * same trust level as shared/metrics.ts. */
export function buildAutoStoryboard(sessionId: string, graph: StoryGraph): Storyboard {
  const beats: NarrativeBeat[] = [];
  for (const beat of graph.beats.values()) {
    if (beat.id === graph.rootId) continue;
    beats.push({
      beatId: beat.id,
      kind: beat.kind,
      description: describeBeat(beat),
      involves: involvesOf(beat),
      citedEventIds: citedEventIdsOf(beat),
      source: "auto",
    });
  }
  return { sessionId, generatedAt: new Date().toISOString(), beats };
}

/** Merges an auto-generated storyboard with an optional agent-authored one
 * persisted for the same session: an agent's entry for a given `beatId`
 * always wins (it represents a richer, deliberately-written account), but
 * every beat the auto pass found and the agent didn't cover still appears
 * with its `source: "auto"` entry rather than being dropped. Never the
 * other way around -- an auto entry never overwrites an agent one. */
export function mergeStoryboards(auto: Storyboard, agent: Storyboard | null): Storyboard {
  if (!agent || agent.beats.length === 0) return auto;
  const byBeatId = new Map(auto.beats.map((b) => [b.beatId, b] as const));
  for (const beat of agent.beats) {
    byBeatId.set(beat.beatId, { ...beat, source: beat.source ?? "agent" });
  }
  // Preserve auto's beat ordering (chronological, from the StoryGraph walk)
  // rather than agent's possibly-partial/reordered list.
  const merged = auto.beats.map((b) => byBeatId.get(b.beatId) ?? b);
  // Any agent beat with no matching auto beat (e.g. a stale/renamed id from
  // an older schema) is still surfaced rather than silently dropped.
  const autoIds = new Set(auto.beats.map((b) => b.beatId));
  const extras = agent.beats.filter((b) => !autoIds.has(b.beatId));
  return {
    sessionId: auto.sessionId,
    generatedAt: agent.generatedAt > auto.generatedAt ? agent.generatedAt : auto.generatedAt,
    beats: [...merged, ...extras],
  };
}
