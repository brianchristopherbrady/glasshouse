// Deterministic rule checks for THE FLOAT (Meridian), per the validator spec
// in prompt.md. Every rule fails with a specific code, not just a boolean —
// this is deliberate: in this world, PASSED can still be wrong (see
// meta_bloomrot.md), so the validator's job is to catch structural errors, not
// to certify that a correction was wise.
import type { WorldData } from "./world-types.js";

export interface ValidationIssue {
  rule: string;
  subject: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  checkedAt: string;
}

function findCharacter(world: WorldData, id: string) {
  return world.characters.characters.find((c) => c.id === id);
}

function findInstitution(world: WorldData, id: string) {
  return world.institutions.institutions.find((i) => i.id === id);
}

function findRelationship(world: WorldData, id: string) {
  return world.float.relationships.find((r) => r.id === id);
}

function entityExists(world: WorldData, id: string): boolean {
  return findCharacter(world, id) !== undefined || findInstitution(world, id) !== undefined;
}

/** ERR_OPEN_PROVENANCE — a character's recognized identity contains
 * relationships whose provenance cannot be traced to a recognized source,
 * yet the character is still marked provenanceStatus: "closed". A character
 * whose identity genuinely does not close (Tomas Vale, B fears for himself)
 * must be marked "open" rather than silently passing as resolved. */
function checkProvenanceClosure(world: WorldData, issues: ValidationIssue[]) {
  for (const character of world.characters.characters) {
    if (character.provenanceStatus !== "closed") continue;
    const anchorId = character.identityAnchorRelationshipId;
    if (!anchorId) continue;
    const anchor = findRelationship(world, anchorId);
    if (!anchor || anchor.provenance === "unknown") {
      issues.push({
        rule: "ERR_OPEN_PROVENANCE",
        subject: character.id,
        message: `'${character.name}' is marked provenanceStatus: closed, but identity anchor '${anchorId}' ${!anchor ? "does not exist" : "has unknown provenance"}.`,
        severity: "error",
      });
    }
  }
}

/** ERR_ORPHANED_REL — a relationship's subject or object is not present in
 * characters.json or institutions.json. */
function checkOrphanedRelationships(world: WorldData, issues: ValidationIssue[]) {
  for (const rel of world.float.relationships) {
    if (!entityExists(world, rel.subject)) {
      issues.push({
        rule: "ERR_ORPHANED_REL",
        subject: rel.id,
        message: `Relationship '${rel.id}' names subject '${rel.subject}', who does not exist in characters.json or institutions.json.`,
        severity: "error",
      });
    }
    if (!entityExists(world, rel.object)) {
      issues.push({
        rule: "ERR_ORPHANED_REL",
        subject: rel.id,
        message: `Relationship '${rel.id}' names object '${rel.object}', who does not exist in characters.json or institutions.json.`,
        severity: "error",
      });
    }
  }
}

/** ERR_UNCOUNTED_DEPENDENT — a correction removed a relationship but did not
 * account for a listed dependent relationship (reconcile/exclude/flag). */
function checkUncountedDependents(world: WorldData, issues: ValidationIssue[]) {
  for (const correction of world.corrections.corrections) {
    const target = findRelationship(world, correction.targetRelationshipId);
    if (!target) continue;
    for (const depId of target.dependentRelationships) {
      const accountedFor = correction.reconciliation.some((r) => r.relationshipId === depId);
      if (!accountedFor) {
        issues.push({
          rule: "ERR_UNCOUNTED_DEPENDENT",
          subject: correction.id,
          message: `Correction '${correction.id}' removed '${target.id}' but did not reconcile, exclude, or flag dependent relationship '${depId}'.`,
          severity: "error",
        });
      }
    }
  }
}

/** ERR_NO_AUTH — a correction has no corresponding authorization on file
 * with an institution that actually holds permission for that operation. */
function checkAuthorization(world: WorldData, issues: ValidationIssue[]) {
  for (const correction of world.corrections.corrections) {
    if (!correction.authorizationId) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: correction.id,
        message: `Correction '${correction.id}' has no authorizationId on file.`,
        severity: "error",
      });
      continue;
    }
    const authorizingInstitution = world.institutions.institutions.find((i) =>
      i.authorizations.includes(correction.authorizationId!),
    );
    if (!authorizingInstitution) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: correction.id,
        message: `Correction '${correction.id}' cites authorization '${correction.authorizationId}', which no institution has on file.`,
        severity: "error",
      });
    } else if (!authorizingInstitution.correctionPermissions.includes(correction.operation)) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: correction.id,
        message: `Correction '${correction.id}' performs '${correction.operation}', which '${authorizingInstitution.name}' is not permitted to authorize.`,
        severity: "error",
      });
    }
  }
}

/** ERR_CLOSED_WITH_RESIDUE — an anomaly is marked closed but an active
 * relationship's displacedConsequences still points to it. */
function checkClosedWithResidue(world: WorldData, issues: ValidationIssue[]) {
  const closedAnomalyIds = new Set(
    world.anomalies.anomalies.filter((a) => a.status === "closed").map((a) => a.id),
  );
  for (const rel of world.float.relationships) {
    if (rel.status !== "active") continue;
    for (const anomalyId of rel.displacedConsequences) {
      if (closedAnomalyIds.has(anomalyId)) {
        issues.push({
          rule: "ERR_CLOSED_WITH_RESIDUE",
          subject: anomalyId,
          message: `Anomaly '${anomalyId}' is closed, but active relationship '${rel.id}' still lists it as a displaced consequence.`,
          severity: "error",
        });
      }
    }
  }
}

/** ERR_TEMPORAL_DUPLICATE — two relationships claim to be the same
 * character's primary identity anchor simultaneously. */
function checkTemporalDuplicateAnchors(world: WorldData, issues: ValidationIssue[]) {
  const anchorHolders = new Map<string, string[]>();
  for (const character of world.characters.characters) {
    if (!character.identityAnchorRelationshipId) continue;
    // Anchors are keyed by the character, but the check that matters is:
    // does more than one *active* relationship claim to anchor this same
    // character? Search float.json for other active relationships whose
    // subject/object is this character and whose kind marks it as an anchor.
    const claims = world.float.relationships.filter(
      (r) => r.status === "active" && (r.subject === character.id || r.object === character.id) && r.kind === "identity-anchor",
    );
    if (claims.length > 1) {
      anchorHolders.set(character.id, claims.map((c) => c.id));
    }
  }
  for (const [characterId, relIds] of anchorHolders) {
    issues.push({
      rule: "ERR_TEMPORAL_DUPLICATE",
      subject: characterId,
      message: `Character '${characterId}' has ${relIds.length} simultaneous active identity-anchor relationships: ${relIds.join(", ")}.`,
      severity: "error",
    });
  }
}

/** WARN_BLOOMROT_CASCADE — a proposed correction targets a relationship
 * already linked to a bloomrot_confirmed anomaly. Does not block; requires
 * explicit human/Choir/House Vey sign-off (see meta_bloomrot.md). */
function checkBloomrotCascade(world: WorldData, issues: ValidationIssue[]) {
  const confirmedBloomrotSources = new Set(
    world.anomalies.anomalies
      .filter((a) => a.provenance === "bloomrot_confirmed" && a.sourceRelationshipId)
      .map((a) => a.sourceRelationshipId!),
  );
  for (const correction of world.corrections.corrections) {
    if (confirmedBloomrotSources.has(correction.targetRelationshipId)) {
      issues.push({
        rule: "WARN_BLOOMROT_CASCADE",
        subject: correction.id,
        message: `Correction '${correction.id}' targets relationship '${correction.targetRelationshipId}', already linked to a bloomrot_confirmed anomaly. Correcting it may feed the network — requires explicit Choir and House Vey sign-off.`,
        severity: "warning",
      });
    }
  }
}

/** WARN_AFFINITY_UNRESOLVED — an anomaly is classified bloomrot_candidate
 * but no semantic affinity chain has been documented. */
function checkAffinityUnresolved(world: WorldData, issues: ValidationIssue[]) {
  for (const anomaly of world.anomalies.anomalies) {
    if (anomaly.provenance === "bloomrot_candidate" && anomaly.semanticAffinityChain.length === 0) {
      issues.push({
        rule: "WARN_AFFINITY_UNRESOLVED",
        subject: anomaly.id,
        message: `Anomaly '${anomaly.id}' is classified bloomrot_candidate but documents no semantic affinity chain.`,
        severity: "warning",
      });
    }
  }
}

export function validateWorld(world: WorldData): ValidationResult {
  const issues: ValidationIssue[] = [];
  checkProvenanceClosure(world, issues);
  checkOrphanedRelationships(world, issues);
  checkUncountedDependents(world, issues);
  checkAuthorization(world, issues);
  checkClosedWithResidue(world, issues);
  checkTemporalDuplicateAnchors(world, issues);
  checkBloomrotCascade(world, issues);
  checkAffinityUnresolved(world, issues);

  return {
    // Only ERR_* issues fail validation. WARN_* issues (bloomrot cascade,
    // affinity unresolved) are surfaced but do not block — per prompt.md's
    // validator spec, WARN_BLOOMROT_CASCADE explicitly "does not block the
    // correction. It requires a human decision."
    valid: issues.every((i) => i.severity !== "error"),
    issues,
    checkedAt: new Date().toISOString(),
  };
}
