import { describe, it, expect } from "vitest";
import { createEvent, checkEvidenceConsistency, FlowbookEventSchema } from "../shared/events.js";

describe("createEvent", () => {
  it("fills in id and timestamp defaults and produces a schema-valid event", () => {
    const event = createEvent({
      sessionId: "session-1",
      type: "tool.completed",
      source: "hook",
      evidence: "observed",
      label: "editFiles completed",
    });
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(() => FlowbookEventSchema.parse(event)).not.toThrow();
  });

  it("rejects a skill.inferred event that claims observed evidence", () => {
    expect(() =>
      createEvent({
        sessionId: "session-1",
        type: "skill.inferred",
        source: "system",
        evidence: "observed",
        label: "Skill likely used",
      }),
    ).toThrow(/inconsistent provenance/);
  });

  it("rejects a directly-observed event type marked as inferred", () => {
    expect(() =>
      createEvent({
        sessionId: "session-1",
        type: "file.read",
        source: "filesystem",
        evidence: "inferred",
        label: "read geography.json",
      }),
    ).toThrow(/inconsistent provenance/);
  });

  it("rejects a decision.declared event not marked declared", () => {
    expect(() =>
      createEvent({
        sessionId: "session-1",
        type: "decision.declared",
        source: "agent-declared",
        evidence: "observed",
        label: "Delegate to Surveyor",
      }),
    ).toThrow(/inconsistent provenance/);
  });

  it("rejects an agent.handoff event not marked declared", () => {
    expect(() =>
      createEvent({
        sessionId: "session-1",
        type: "agent.handoff",
        source: "agent-declared",
        evidence: "observed",
        label: "planner → implementer",
      }),
    ).toThrow(/inconsistent provenance/);
  });

  it("accepts a correctly declared agent.handoff event", () => {
    const event = createEvent({
      sessionId: "session-1",
      type: "agent.handoff",
      source: "agent-declared",
      evidence: "declared",
      label: "planner → implementer",
      metadata: { fromAgent: "planner", toAgent: "implementer", reason: "plan is ready" },
    });
    expect(() => FlowbookEventSchema.parse(event)).not.toThrow();
  });

  it("rejects a run.started event not marked declared", () => {
    expect(() =>
      createEvent({
        sessionId: "session-1",
        type: "run.started",
        source: "agent-declared",
        evidence: "observed",
        label: "Widget work",
      }),
    ).toThrow(/inconsistent provenance/);
  });

  it("accepts a correctly declared run.started event", () => {
    const event = createEvent({
      sessionId: "session-1",
      type: "run.started",
      source: "agent-declared",
      evidence: "declared",
      label: "Widget work",
    });
    expect(() => FlowbookEventSchema.parse(event)).not.toThrow();
  });
});

describe("checkEvidenceConsistency", () => {
  it("returns no issues for a correctly labeled inferred skill event", () => {
    const issues = checkEvidenceConsistency({ type: "skill.inferred", evidence: "inferred" });
    expect(issues).toEqual([]);
  });

  it("returns no issues for a correctly labeled observed hook event", () => {
    const issues = checkEvidenceConsistency({ type: "hook.started", evidence: "observed" });
    expect(issues).toEqual([]);
  });
});
