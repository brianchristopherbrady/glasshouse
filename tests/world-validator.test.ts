import { describe, it, expect } from "vitest";
import { validateWorld } from "../shared/world-validator.js";
import { loadWorld } from "../shared/world-loader.js";
import type { WorldData } from "../shared/world-types.js";

function baseWorld(): WorldData {
  return {
    relationships: {
      relationships: [
        {
          id: "rel-1",
          subject: "structure-a",
          object: "structure-b",
          kind: "identity-anchor",
          status: "active",
          provenance: "organic",
          dependentRelationships: [],
          displacedConsequences: [],
        },
      ],
    },
    corrections: {
      corrections: [],
    },
    issues: {
      issues: [],
    },
    characters: {
      characters: [
        { id: "structure-a", name: "Structure A", provenanceStatus: "closed", identityAnchorRelationshipId: "rel-1" },
        { id: "structure-b", name: "Structure B", provenanceStatus: "closed" },
      ],
    },
    institutions: {
      institutions: [
        {
          id: "city-council",
          name: "City Council",
          correctionPermissions: ["sever", "redirect", "reconcile"],
          knownBiases: [],
          authorizations: ["auth-1"],
        },
      ],
    },
  };
}

describe("validateWorld", () => {
  it("passes a well-formed baseline world", () => {
    const result = validateWorld(baseWorld());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("loads and validates the real world/ directory as valid", async () => {
    const world = await loadWorld();
    const result = validateWorld(world);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("ERR_OPEN_PROVENANCE: flags a closed character whose identity anchor has unknown provenance", () => {
    const world = baseWorld();
    world.relationships.relationships[0]!.provenance = "unknown";
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_OPEN_PROVENANCE");
  });

  it("does not flag a character explicitly marked provenanceStatus: open", () => {
    const world = baseWorld();
    world.relationships.relationships[0]!.provenance = "unknown";
    world.characters.characters[0]!.provenanceStatus = "open";
    const result = validateWorld(world);
    expect(result.issues.map((i) => i.rule)).not.toContain("ERR_OPEN_PROVENANCE");
  });

  it("ERR_ORPHANED_REL: flags a relationship whose subject does not exist", () => {
    const world = baseWorld();
    world.relationships.relationships.push({
      id: "rel-2",
      subject: "ghost",
      object: "structure-b",
      kind: "acquaintance",
      status: "active",
      provenance: "organic",
      dependentRelationships: [],
      displacedConsequences: [],
    });
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_ORPHANED_REL");
  });

  it("ERR_UNCOUNTED_DEPENDENT: flags a correction that removes a relationship without reconciling a dependent", () => {
    const world = baseWorld();
    world.relationships.relationships[0]!.dependentRelationships = ["rel-dependent"];
    world.corrections.corrections.push({
      id: "correction-1",
      targetRelationshipId: "rel-1",
      operation: "sever",
      authorizationId: "auth-1",
      reconciliation: [],
      protectedInvariants: [],
    });
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_UNCOUNTED_DEPENDENT");
  });

  it("passes once the dependent relationship is reconciled or explicitly excluded", () => {
    const world = baseWorld();
    world.relationships.relationships[0]!.dependentRelationships = ["rel-dependent"];
    world.corrections.corrections.push({
      id: "correction-1",
      targetRelationshipId: "rel-1",
      operation: "sever",
      authorizationId: "auth-1",
      reconciliation: [{ relationshipId: "rel-dependent", disposition: "excluded", justification: "Not in scope." }],
      protectedInvariants: [],
    });
    const result = validateWorld(world);
    expect(result.valid).toBe(true);
  });

  it("ERR_NO_AUTH: flags a correction with no authorizationId", () => {
    const world = baseWorld();
    world.corrections.corrections.push({
      id: "correction-1",
      targetRelationshipId: "rel-1",
      operation: "sever",
      reconciliation: [],
      protectedInvariants: [],
    });
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_NO_AUTH");
  });

  it("ERR_NO_AUTH: flags a correction whose operation the citing institution isn't permitted to authorize", () => {
    const world = baseWorld();
    world.corrections.corrections.push({
      id: "correction-1",
      targetRelationshipId: "rel-1",
      operation: "bind",
      authorizationId: "auth-1",
      reconciliation: [],
      protectedInvariants: [],
    });
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_NO_AUTH");
  });

  it("ERR_CLOSED_WITH_RESIDUE: flags a closed issue still referenced by an active relationship", () => {
    const world = baseWorld();
    world.issues.issues.push({
      id: "issue-1",
      description: "A cake with one slice missing.",
      provenance: "correction_residue",
      semanticAffinityChain: [],
      status: "closed",
    });
    world.relationships.relationships[0]!.displacedConsequences = ["issue-1"];
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_CLOSED_WITH_RESIDUE");
  });

  it("ERR_TEMPORAL_DUPLICATE: flags two simultaneous active identity-anchor relationships for the same character", () => {
    const world = baseWorld();
    world.relationships.relationships.push({
      id: "rel-2",
      subject: "structure-a",
      object: "structure-c",
      kind: "identity-anchor",
      status: "active",
      provenance: "organic",
      dependentRelationships: [],
      displacedConsequences: [],
    });
    world.characters.characters.push({ id: "structure-c", name: "Structure C", provenanceStatus: "closed" });
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.rule)).toContain("ERR_TEMPORAL_DUPLICATE");
  });

  it("WARN_SYSTEMIC_CASCADE: warns (but does not block) a correction targeting a systemic_confirmed source", () => {
    const world = baseWorld();
    world.issues.issues.push({
      id: "issue-1",
      description: "A recurring outage traced to a single shared dependency.",
      provenance: "systemic_confirmed",
      sourceRelationshipId: "rel-1",
      semanticAffinityChain: [],
      status: "open",
    });
    world.corrections.corrections.push({
      id: "correction-1",
      targetRelationshipId: "rel-1",
      operation: "sever",
      authorizationId: "auth-1",
      reconciliation: [],
      protectedInvariants: [],
    });
    const result = validateWorld(world);
    expect(result.issues.map((i) => i.rule)).toContain("WARN_SYSTEMIC_CASCADE");
    // Warnings do not block validity on their own.
    expect(result.valid).toBe(true);
  });

  it("WARN_AFFINITY_UNRESOLVED: warns when a systemic_candidate issue documents no affinity chain", () => {
    const world = baseWorld();
    world.issues.issues.push({
      id: "issue-1",
      description: "An intermittent failure with no obvious single cause yet.",
      provenance: "systemic_candidate",
      semanticAffinityChain: [],
      status: "open",
    });
    const result = validateWorld(world);
    expect(result.issues.map((i) => i.rule)).toContain("WARN_AFFINITY_UNRESOLVED");
    expect(result.valid).toBe(true);
  });

  it("does not warn when a systemic_candidate issue documents an affinity chain", () => {
    const world = baseWorld();
    world.issues.issues.push({
      id: "issue-1",
      description: "An intermittent failure with no obvious single cause yet.",
      provenance: "systemic_candidate",
      semanticAffinityChain: ["deploy-freeze-incident", "infra/shared-cache/eviction"],
      status: "open",
    });
    const result = validateWorld(world);
    expect(result.issues.map((i) => i.rule)).not.toContain("WARN_AFFINITY_UNRESOLVED");
  });
});
