import { describe, it, expect } from "vitest";
import { createEvent, checkEvidenceConsistency, AgentariumEventSchema } from "../shared/events.js";

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
    expect(() => AgentariumEventSchema.parse(event)).not.toThrow();
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
