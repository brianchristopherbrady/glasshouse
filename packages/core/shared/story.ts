// Derives a branching STORY from the flat event log: each "beat" is a
// character's decision (or a structurally equivalent milestone -- an agent
// taking up the case, a specialist being summoned, or a validation
// outcome), the tool/file/skill/mcp activity it caused (its "effects"), and
// any beats it directly led to (its "children" -- a single decision can
// spawn more than one child beat, e.g. two specialists summoned in a row,
// which is what makes this a tree rather than a single chain). This module
// is intentionally independent of the tool-call-level EventGraph model:
// every field here is read straight off real events (per
// .github/instructions/observability.instructions.md) -- nothing is
// invented, and `evidence`/`reason`/`next` are carried through verbatim
// rather than paraphrased into something stronger than it is.
import type { FlowbookEvent } from "./events.js";

export type StoryBeatKind = "root" | "agent" | "subagent" | "decision" | "validation" | "milestone" | "handoff";

export interface StoryBeat {
  id: string;
  kind: StoryBeatKind;
  title: string;
  character?: string;
  timestamp: string;
  evidence: FlowbookEvent["evidence"];
  reason?: string;
  next?: string;
  alternatives?: string[];
  confidence?: number;
  fromAgent?: string;
  toAgent?: string;
  sourceEvent?: FlowbookEvent;
  parentId: string | null;
  childIds: string[];
  effects: FlowbookEvent[];
  unresolved: boolean;
  unresolvedReason?: string;
}

export interface StoryGraph {
  beats: Map<string, StoryBeat>;
  order: string[];
  rootId: string;
}

const ROOT_ID = "beat:root";

function strMeta(event: FlowbookEvent, key: string): string | undefined {
  const v = event.metadata?.[key];
  return typeof v === "string" ? v : undefined;
}
function numMeta(event: FlowbookEvent, key: string): number | undefined {
  const v = event.metadata?.[key];
  return typeof v === "number" ? v : undefined;
}
function arrMeta(event: FlowbookEvent, key: string): string[] | undefined {
  const v = event.metadata?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
}

function laneKey(event: FlowbookEvent): string {
  if (event.actor?.kind === "subagent") return `subagent:${event.actor.id}`;
  return "main";
}

function makeBeat(id: string, kind: StoryBeatKind, title: string, event: FlowbookEvent, parentId: string): StoryBeat {
  return {
    id,
    kind,
    title,
    character: event.actor?.name ?? event.actor?.id,
    timestamp: event.timestamp,
    evidence: event.evidence,
    sourceEvent: event,
    parentId,
    childIds: [],
    effects: [],
    unresolved: false,
  };
}

/**
 * Walks the event log once, in order, producing a real tree (single parent
 * per beat, but a beat may have many children) of narrative beats plus, per
 * beat, the ordinary tool/file/skill/mcp/hook events that happened
 * downstream of it before the next beat replaced it as the active anchor
 * for that lane. `session.started` folds into the synthetic root beat
 * rather than becoming its own node, since it carries no story content of
 * its own beyond "a session began".
 */
export function buildStoryGraph(events: FlowbookEvent[]): StoryGraph {
  const beats = new Map<string, StoryBeat>();
  const order: string[] = [];

  const root: StoryBeat = {
    id: ROOT_ID,
    kind: "root",
    title: "The session began",
    timestamp: events[0]?.timestamp ?? new Date(0).toISOString(),
    evidence: "observed",
    parentId: null,
    childIds: [],
    effects: [],
    unresolved: false,
  };
  beats.set(ROOT_ID, root);
  order.push(ROOT_ID);

  const lanePointer = new Map<string, string>([["main", ROOT_ID]]);
  const openFailure = new Map<string, string>(); // lane -> beat id of a not-yet-repassed validation.failed

  function addChild(parentId: string, childId: string) {
    beats.get(parentId)?.childIds.push(childId);
  }

  let seq = 0;

  for (const event of events) {
    switch (event.type) {
      case "session.started":
        continue;

      case "agent.started": {
        const parentId = lanePointer.get("main")!;
        const id = `beat:agent:${event.actor?.id ?? seq++}`;
        beats.set(
          id,
          makeBeat(id, "agent", event.actor?.name ? `${event.actor.name} took up the case.` : "An agent took up the case.", event, parentId),
        );
        addChild(parentId, id);
        order.push(id);
        lanePointer.set("main", id);
        break;
      }

      case "subagent.started": {
        // Simplifying assumption (shared with the event graph): subagents
        // are spawned from the main agent's lane, not from each other --
        // this repo's model doesn't currently produce nested delegation.
        const parentId = lanePointer.get("main")!;
        const subLane = `subagent:${event.actor?.id ?? event.id}`;
        const id = `beat:subagent:${event.actor?.id ?? seq++}`;
        beats.set(
          id,
          makeBeat(id, "subagent", event.actor?.name ? `${event.actor.name} was summoned.` : "A specialist was summoned.", event, parentId),
        );
        addChild(parentId, id);
        order.push(id);
        lanePointer.set(subLane, id);
        break;
      }

      case "agent.handoff": {
        // Anchors the handoff beat under whichever agent/subagent is
        // currently active in the declaring lane (the outgoing agent), then
        // becomes the new "main" anchor itself -- so the successor agent's
        // own agent.started beat parents under the handoff, not under root
        // or the outgoing agent directly. This is what turns a sequence of
        // handoffs into a real chain (A -> handoff -> B -> handoff -> C)
        // instead of every agent flattening onto one undifferentiated lane.
        const lane = laneKey(event);
        const parentId = lanePointer.get(lane) ?? lanePointer.get("main")!;
        const id = `beat:handoff:${event.id}`;
        const beat = makeBeat(id, "handoff", event.label, event, parentId);
        beat.reason = strMeta(event, "reason");
        beat.fromAgent = strMeta(event, "fromAgent");
        beat.toAgent = strMeta(event, "toAgent");
        beats.set(id, beat);
        addChild(parentId, id);
        order.push(id);
        lanePointer.set("main", id);
        break;
      }

      case "decision.declared": {
        const lane = laneKey(event);
        const parentId = lanePointer.get(lane) ?? lanePointer.get("main")!;
        const id = `beat:decision:${event.id}`;
        const beat = makeBeat(id, "decision", event.label, event, parentId);
        beat.reason = strMeta(event, "reason");
        beat.next = strMeta(event, "next");
        beat.confidence = numMeta(event, "confidence");
        beat.alternatives = arrMeta(event, "alternatives");
        beats.set(id, beat);
        addChild(parentId, id);
        order.push(id);
        lanePointer.set(lane, id);
        break;
      }

      case "validation.failed":
      case "validation.passed": {
        const lane = laneKey(event);
        const parentId = lanePointer.get(lane) ?? lanePointer.get("main")!;
        const id = `beat:validation:${event.id}`;
        const beat = makeBeat(
          id,
          "validation",
          event.type === "validation.failed" ? "The validator found a contradiction." : "The validator confirmed reality holds together.",
          event,
          parentId,
        );
        beats.set(id, beat);
        addChild(parentId, id);
        order.push(id);
        lanePointer.set(lane, id);
        if (event.type === "validation.failed") openFailure.set(lane, id);
        else openFailure.delete(lane);
        break;
      }

      case "task.completed": {
        const parentId = lanePointer.get("main")!;
        const id = `beat:milestone:${event.id}`;
        beats.set(id, makeBeat(id, "milestone", event.label, event, parentId));
        addChild(parentId, id);
        order.push(id);
        break;
      }

      case "run.started": {
        // A run boundary anchors at root (not the current "main" lane
        // pointer) -- it marks a new, distinct unit of work starting
        // within the session, not a continuation of whatever came before.
        const id = `beat:run:${event.id}`;
        beats.set(id, makeBeat(id, "milestone", `New run: ${event.label}`, event, ROOT_ID));
        addChild(ROOT_ID, id);
        order.push(id);
        lanePointer.set("main", id);
        break;
      }

      default: {
        const lane = laneKey(event);
        const anchorId = lanePointer.get(lane) ?? lanePointer.get("main")!;
        beats.get(anchorId)?.effects.push(event);
        break;
      }
    }
  }

  // A validation.failed with no later validation.passed in the same lane is
  // a genuinely open thread -- the world was left in a known-broken state,
  // whether or not anyone declared a decision about it.
  for (const beatId of openFailure.values()) {
    const beat = beats.get(beatId);
    if (beat) {
      beat.unresolved = true;
      beat.unresolvedReason = "No later successful validation followed this failure in the observed events.";
    }
  }

  // A decision that stated an intended next step but was never followed by
  // any further beat or observed effect is also an open thread -- the
  // agent said what it planned to do and the record simply stops there.
  for (const beat of beats.values()) {
    if (beat.kind === "decision" && beat.next && beat.childIds.length === 0 && beat.effects.length === 0) {
      beat.unresolved = true;
      beat.unresolvedReason = `The declared next step ("${beat.next}") was never observed to happen.`;
    }
  }

  // A handoff with no observed follow-through (no child beat, e.g. the
  // successor agent never showed up as agent.started/subagent.started, and
  // no effects attributed to it either) is an open thread -- the outgoing
  // agent declared it was passing the task on, but nothing afterward
  // confirms the successor actually took it up.
  for (const beat of beats.values()) {
    if (beat.kind === "handoff" && beat.childIds.length === 0 && beat.effects.length === 0) {
      beat.unresolved = true;
      beat.unresolvedReason = `The handoff to "${beat.toAgent ?? "another agent"}" was never observed to be picked up.`;
    }
  }

  return { beats, order, rootId: ROOT_ID };
}

const NODE_W = 220;
const GAP_X = 16;
const LEVEL_H = 84;

/** Compact tidy-tree layout: unlike a generic DAG layout, this operates on a
 * real single-parent tree (StoryBeat.childIds), so there's no "first parent
 * wins" ambiguity to resolve -- every node is centered above its own
 * children so edges stay short and vertical. */
export function layoutStoryGraph(
  graph: StoryGraph,
  opts: { nodeWidth?: number; gapX?: number; levelHeight?: number } = {},
): Map<string, { x: number; y: number }> {
  const nodeWidth = opts.nodeWidth ?? NODE_W;
  const gapX = opts.gapX ?? GAP_X;
  const levelHeight = opts.levelHeight ?? LEVEL_H;

  const widths = new Map<string, number>();
  function subtreeWidth(id: string): number {
    const children = graph.beats.get(id)?.childIds ?? [];
    if (children.length === 0) {
      widths.set(id, nodeWidth);
      return nodeWidth;
    }
    let total = 0;
    children.forEach((childId, i) => {
      total += subtreeWidth(childId);
      if (i < children.length - 1) total += gapX;
    });
    const w = Math.max(nodeWidth, total);
    widths.set(id, w);
    return w;
  }
  subtreeWidth(graph.rootId);

  const positions = new Map<string, { x: number; y: number }>();
  function place(id: string, leftX: number, depth: number) {
    const w = widths.get(id) ?? nodeWidth;
    const children = graph.beats.get(id)?.childIds ?? [];
    if (children.length > 0) {
      let childrenTotal = 0;
      children.forEach((childId, i) => {
        childrenTotal += widths.get(childId) ?? nodeWidth;
        if (i < children.length - 1) childrenTotal += gapX;
      });
      let cx = leftX + (w - childrenTotal) / 2;
      children.forEach((childId) => {
        const cw = widths.get(childId) ?? nodeWidth;
        place(childId, cx, depth + 1);
        cx += cw + gapX;
      });
    }
    positions.set(id, { x: leftX + w / 2, y: depth * levelHeight });
  }
  place(graph.rootId, 0, 0);

  return positions;
}

/** Ancestor beats from (excluding) `beatId` up to the root, nearest first --
 * useful for a breadcrumb trail in a detail panel. */
export function ancestorsOf(graph: StoryGraph, beatId: string): StoryBeat[] {
  const chain: StoryBeat[] = [];
  let current = graph.beats.get(beatId)?.parentId ?? null;
  while (current) {
    const beat = graph.beats.get(current);
    if (!beat) break;
    chain.push(beat);
    current = beat.parentId;
  }
  return chain;
}
