// Generates demo trace JSONL files under demo/, used by the dashboard's
// "demo" mode (Phase 12). These are handwritten fictional but structurally
// realistic Float sessions — every event still goes through createEvent() so
// schema/provenance rules are enforced exactly as they would be for a live
// run. All events are additionally tagged `source: "demo"` so the UI can
// label them unambiguously (see shared/events.ts's isDemoEvent and the
// charter's demo-mode requirement).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createEvent, type AgentEventType, type ActorKind, type EvidenceLevel } from "../shared/events.js";

const DEMO_DIR = path.resolve(process.cwd(), "demo");

interface Spec {
  type: AgentEventType;
  label: string;
  evidence: EvidenceLevel;
  actor?: { id: string; kind: ActorKind; name?: string };
  parentId?: string;
  metadata?: Record<string, unknown>;
  stepMs?: number; // time to advance from the previous event, default 900ms
}

function buildTrace(sessionId: string, startIso: string, specs: Spec[]) {
  let clock = Date.parse(startIso);
  const events = specs.map((spec) => {
    clock += spec.stepMs ?? 900;
    return createEvent({
      sessionId,
      type: spec.type,
      source: "demo",
      evidence: spec.evidence,
      label: spec.label,
      actor: spec.actor,
      parentId: spec.parentId,
      metadata: spec.metadata,
      timestamp: new Date(clock).toISOString(),
    });
  });
  return events;
}

// --- Trace 1: Tomas Vale audit (contains a real validation failure + repair loop) ---
const tomasVale = buildTrace("demo-tomas-vale-audit", "2026-01-14T09:00:00.000Z", [
  { type: "session.started", label: "Session started", evidence: "observed", actor: { id: "system", kind: "system" } },
  {
    type: "prompt.received",
    label: "Prompt: Audit whether Tomas Vale's employment correction properly accounted for the birthday ritual.",
    evidence: "observed",
    actor: { id: "user", kind: "user" },
  },
  { type: "agent.started", label: "Mote started", evidence: "observed", actor: { id: "agent", kind: "agent", name: "Mote" } },
  {
    type: "decision.declared",
    label: "Decision: Delegate the correction-record audit to Noor before drawing any conclusion.",
    evidence: "declared",
    actor: { id: "agent", kind: "agent", name: "Mote" },
    metadata: { reason: "Provenance/reconciliation history is Noor's domain, not mine to guess at.", confidence: 0.88 },
  },
  { type: "subagent.started", label: "Subagent started: Noor", evidence: "observed", actor: { id: "noor-1", kind: "subagent", name: "Noor" } },
  {
    type: "skill.accessed",
    label: "Skill accessed: provenance-audit",
    evidence: "observed",
    actor: { id: "noor-1", kind: "subagent", name: "Noor" },
    metadata: { skill: "provenance-audit" },
  },
  {
    type: "tool.completed",
    label: "Tool completed: read_file",
    evidence: "observed",
    actor: { id: "noor-1", kind: "subagent", name: "Noor" },
    metadata: { tool: "read_file", path: "world/corrections.json" },
  },
  {
    type: "file.read",
    label: "File read: world/corrections.json",
    evidence: "observed",
    actor: { id: "noor-1", kind: "subagent", name: "Noor" },
    metadata: { path: "world/corrections.json" },
  },
  { type: "subagent.stopped", label: "Subagent stopped: Noor", evidence: "observed", actor: { id: "noor-1", kind: "subagent", name: "Noor" } },
  {
    type: "mcp.tool.called",
    label: "MCP tool called: validate_world",
    evidence: "observed",
    actor: { id: "agent", kind: "agent", name: "Mote" },
    metadata: { tool: "validate_world" },
  },
  { type: "validation.started", label: "Validation started", evidence: "observed", actor: { id: "system", kind: "system" } },
  {
    type: "validation.failed",
    label: "Reality has developed an administrative problem.",
    evidence: "observed",
    actor: { id: "system", kind: "system" },
    metadata: { issues: ["ERR_UNCOUNTED_DEPENDENT: correction-tomas-employment did not reconcile rel-tomas-birthday-ritual"] },
  },
  {
    type: "decision.declared",
    label: "Decision: Repair by explicitly excluding the birthday ritual with justification, not silently reconciling it.",
    evidence: "declared",
    actor: { id: "agent", kind: "agent", name: "Mote" },
    metadata: { reason: "The ritual was genuinely not in scope of the original petition — the honest fix is to document that, not to invent a disposition that didn't happen.", confidence: 0.91 },
  },
  {
    type: "subagent.started",
    label: "Subagent started: Asterion Dev",
    evidence: "observed",
    actor: { id: "asterion-1", kind: "subagent", name: "Asterion Dev" },
  },
  {
    type: "skill.accessed",
    label: "Skill accessed: correction-mechanics",
    evidence: "observed",
    actor: { id: "asterion-1", kind: "subagent", name: "Asterion Dev" },
    metadata: { skill: "correction-mechanics" },
  },
  {
    type: "tool.completed",
    label: "Tool completed: replace_string_in_file",
    evidence: "observed",
    actor: { id: "asterion-1", kind: "subagent", name: "Asterion Dev" },
    metadata: { tool: "replace_string_in_file", path: "world/corrections.json" },
  },
  {
    type: "file.written",
    label: "File written: world/corrections.json",
    evidence: "observed",
    actor: { id: "asterion-1", kind: "subagent", name: "Asterion Dev" },
    metadata: { path: "world/corrections.json" },
  },
  { type: "subagent.stopped", label: "Subagent stopped: Asterion Dev", evidence: "observed", actor: { id: "asterion-1", kind: "subagent", name: "Asterion Dev" } },
  {
    type: "mcp.tool.called",
    label: "MCP tool called: validate_world",
    evidence: "observed",
    actor: { id: "agent", kind: "agent", name: "Mote" },
    metadata: { tool: "validate_world" },
  },
  { type: "validation.started", label: "Validation started", evidence: "observed", actor: { id: "system", kind: "system" } },
  {
    type: "validation.passed",
    label: "Reality remains provisionally legal.",
    evidence: "observed",
    actor: { id: "system", kind: "system" },
  },
  {
    type: "subagent.started",
    label: "Subagent started: House Vey",
    evidence: "observed",
    actor: { id: "house-vey-1", kind: "subagent", name: "House Vey" },
  },
  {
    type: "subagent.stopped",
    label: "Subagent stopped: House Vey",
    evidence: "observed",
    actor: { id: "house-vey-1", kind: "subagent", name: "House Vey" },
  },
  { type: "agent.stopped", label: "Mote stopped", evidence: "observed", actor: { id: "agent", kind: "agent", name: "Mote" } },
  { type: "task.completed", label: "Task completed: Tomas Vale correction reconciliation documented", evidence: "observed", actor: { id: "system", kind: "system" } },
]);

// --- Trace 2: Western Tolerance Hall classification (clean run, no failures, shows skill.inferred) ---
const bloomrot = buildTrace("demo-western-tolerance-hall", "2026-02-03T14:00:00.000Z", [
  { type: "session.started", label: "Session started", evidence: "observed", actor: { id: "system", kind: "system" } },
  {
    type: "prompt.received",
    label: "Prompt: Determine whether Western Tolerance Hall's evacuation is ordinary or Bloomrot.",
    evidence: "observed",
    actor: { id: "user", kind: "user" },
  },
  { type: "agent.started", label: "Mote started", evidence: "observed", actor: { id: "agent", kind: "agent", name: "Mote" } },
  {
    type: "subagent.started",
    label: "Subagent started: B",
    evidence: "observed",
    actor: { id: "b-1", kind: "subagent", name: "B" },
  },
  {
    type: "skill.accessed",
    label: "Skill accessed: bloomrot-classification",
    evidence: "observed",
    actor: { id: "b-1", kind: "subagent", name: "B" },
    metadata: { skill: "bloomrot-classification" },
  },
  {
    type: "skill.inferred",
    label: "Skill likely referenced: chrysanthemum-practice (assessing carrier vocabulary)",
    evidence: "inferred",
    actor: { id: "b-1", kind: "subagent", name: "B" },
    metadata: { skill: "chrysanthemum-practice", confidence: 0.4 },
  },
  {
    type: "tool.completed",
    label: "Tool completed: replace_string_in_file",
    evidence: "observed",
    actor: { id: "b-1", kind: "subagent", name: "B" },
    metadata: { tool: "replace_string_in_file", path: "world/anomalies.json" },
  },
  {
    type: "file.written",
    label: "File written: world/anomalies.json",
    evidence: "observed",
    actor: { id: "b-1", kind: "subagent", name: "B" },
    metadata: { path: "world/anomalies.json" },
  },
  {
    type: "decision.declared",
    label: "Decision: Classify as bloomrot_confirmed — no local labor dispute exists, but the South Quay semantic pattern (leave/exit/return/refusal) matches exactly.",
    evidence: "declared",
    actor: { id: "b-1", kind: "subagent", name: "B" },
    metadata: { reason: "Physical behavior is identical to South Quay, but the sufficient local cause is absent here — that displacement is the Bloomrot signature, not the physical impossibility itself.", confidence: 0.81 },
  },
  { type: "subagent.stopped", label: "Subagent stopped: B", evidence: "observed", actor: { id: "b-1", kind: "subagent", name: "B" } },
  {
    type: "mcp.tool.called",
    label: "MCP tool called: validate_world",
    evidence: "observed",
    actor: { id: "agent", kind: "agent", name: "Mote" },
    metadata: { tool: "validate_world" },
  },
  { type: "validation.started", label: "Validation started", evidence: "observed", actor: { id: "system", kind: "system" } },
  { type: "validation.passed", label: "Reality remains provisionally legal.", evidence: "observed", actor: { id: "system", kind: "system" } },
  { type: "agent.stopped", label: "Mote stopped", evidence: "observed", actor: { id: "agent", kind: "agent", name: "Mote" } },
  { type: "task.completed", label: "Task completed: Western Tolerance Hall classification documented", evidence: "observed", actor: { id: "system", kind: "system" } },
]);

async function writeTrace(name: string, events: ReturnType<typeof buildTrace>) {
  await mkdir(DEMO_DIR, { recursive: true });
  const jsonl = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(path.join(DEMO_DIR, `${name}.jsonl`), jsonl, "utf-8");
  console.log(`Wrote demo/${name}.jsonl (${events.length} events)`);
}

async function main() {
  await writeTrace("tomas-vale-audit", tomasVale);
  await writeTrace("western-tolerance-hall", bloomrot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
