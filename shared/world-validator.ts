// Deterministic rule checks for the world model. PASSED can still be wrong
// (see the issue-tracking Skill) -- the validator's job is to catch
// structural errors, not to certify that a change was wise.
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

function findStructure(world: WorldData, id: string) {
  return world.structures.structures.find((c) => c.id === id);
}

function findInstitution(world: WorldData, id: string) {
  return world.institutions.institutions.find((i) => i.id === id);
}

function findRelationship(world: WorldData, id: string) {
  return world.relationships.relationships.find((r) => r.id === id);
}

function entityExists(world: WorldData, id: string): boolean {
  return findStructure(world, id) !== undefined || findInstitution(world, id) !== undefined;
}

/** ERR_OPEN_PROVENANCE — a structure's recognized identity contains
 * relationships whose provenance cannot be traced to a recognized source,
 * yet the structure is still marked provenanceStatus: "closed". A structure
 * whose identity genuinely does not close (Tomas Vale, B fears for himself)
 * must be marked "open" rather than silently passing as resolved. */
function checkProvenanceClosure(world: WorldData, issues: ValidationIssue[]) {
  for (const structure of world.structures.structures) {
    if (structure.provenanceStatus !== "closed") continue;
    const anchorId = structure.identityAnchorRelationshipId;
    if (!anchorId) continue;
    const anchor = findRelationship(world, anchorId);
    if (!anchor || anchor.provenance === "unknown") {
      issues.push({
        rule: "ERR_OPEN_PROVENANCE",
        subject: structure.id,
        message: `'${structure.name}' is marked provenanceStatus: closed, but identity anchor '${anchorId}' ${!anchor ? "does not exist" : "has unknown provenance"}.`,
        severity: "error",
      });
    }
  }
}

/** ERR_ORPHANED_REL — a relationship's subject or object is not present in
 * structures.json or institutions.json. */
function checkOrphanedRelationships(world: WorldData, issues: ValidationIssue[]) {
  for (const rel of world.relationships.relationships) {
    if (!entityExists(world, rel.subject)) {
      issues.push({
        rule: "ERR_ORPHANED_REL",
        subject: rel.id,
        message: `Relationship '${rel.id}' names subject '${rel.subject}', who does not exist in structures.json or institutions.json.`,
        severity: "error",
      });
    }
    if (!entityExists(world, rel.object)) {
      issues.push({
        rule: "ERR_ORPHANED_REL",
        subject: rel.id,
        message: `Relationship '${rel.id}' names object '${rel.object}', who does not exist in structures.json or institutions.json.`,
        severity: "error",
      });
    }
  }
}

/** ERR_UNCOUNTED_DEPENDENT — a change removed a relationship but did not
 * account for a listed dependent relationship (reconcile/exclude/flag). */
function checkUncountedDependents(world: WorldData, issues: ValidationIssue[]) {
  for (const change of world.changes.changes) {
    const target = findRelationship(world, change.targetRelationshipId);
    if (!target) continue;
    for (const depId of target.dependentRelationships) {
      const accountedFor = change.reconciliation.some((r) => r.relationshipId === depId);
      if (!accountedFor) {
        issues.push({
          rule: "ERR_UNCOUNTED_DEPENDENT",
          subject: change.id,
          message: `Change '${change.id}' removed '${target.id}' but did not reconcile, exclude, or flag dependent relationship '${depId}'.`,
          severity: "error",
        });
      }
    }
  }
}

/** ERR_NO_AUTH — a change has no corresponding authorization on file
 * with an institution that actually holds permission for that operation. */
function checkAuthorization(world: WorldData, issues: ValidationIssue[]) {
  for (const change of world.changes.changes) {
    if (!change.authorizationId) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: change.id,
        message: `Change '${change.id}' has no authorizationId on file.`,
        severity: "error",
      });
      continue;
    }
    const authorizingInstitution = world.institutions.institutions.find((i) =>
      i.authorizations.includes(change.authorizationId!),
    );
    if (!authorizingInstitution) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: change.id,
        message: `Change '${change.id}' cites authorization '${change.authorizationId}', which no institution has on file.`,
        severity: "error",
      });
    } else if (!authorizingInstitution.changePermissions.includes(change.operation)) {
      issues.push({
        rule: "ERR_NO_AUTH",
        subject: change.id,
        message: `Change '${change.id}' performs '${change.operation}', which '${authorizingInstitution.name}' is not permitted to authorize.`,
        severity: "error",
      });
    }
  }
}

/** ERR_CLOSED_WITH_RESIDUE — an issue is marked closed but an active
 * relationship's displacedConsequences still points to it. */
function checkClosedWithResidue(world: WorldData, issues: ValidationIssue[]) {
  const closedIssueIds = new Set(
    world.issues.issues.filter((i) => i.status === "closed").map((i) => i.id),
  );
  for (const rel of world.relationships.relationships) {
    if (rel.status !== "active") continue;
    for (const issueId of rel.displacedConsequences) {
      if (closedIssueIds.has(issueId)) {
        issues.push({
          rule: "ERR_CLOSED_WITH_RESIDUE",
          subject: issueId,
          message: `Issue '${issueId}' is closed, but active relationship '${rel.id}' still lists it as a displaced consequence.`,
          severity: "error",
        });
      }
    }
  }
}

/** ERR_TEMPORAL_DUPLICATE — two relationships claim to be the same
 * structure's primary identity anchor simultaneously. */
function checkTemporalDuplicateAnchors(world: WorldData, issues: ValidationIssue[]) {
  const anchorHolders = new Map<string, string[]>();
  for (const structure of world.structures.structures) {
    if (!structure.identityAnchorRelationshipId) continue;
    // Anchors are keyed by the structure, but the check that matters is:
    // does more than one *active* relationship claim to anchor this same
    // structure? Search relationships.json for other active relationships
    // whose subject/object is this structure and whose kind marks it as an
    // anchor.
    const claims = world.relationships.relationships.filter(
      (r) => r.status === "active" && (r.subject === structure.id || r.object === structure.id) && r.kind === "identity-anchor",
    );
    if (claims.length > 1) {
      anchorHolders.set(structure.id, claims.map((c) => c.id));
    }
  }
  for (const [structureId, relIds] of anchorHolders) {
    issues.push({
      rule: "ERR_TEMPORAL_DUPLICATE",
      subject: structureId,
      message: `Structure '${structureId}' has ${relIds.length} simultaneous active identity-anchor relationships: ${relIds.join(", ")}.`,
      severity: "error",
    });
  }
}

/** WARN_SYSTEMIC_CASCADE — a proposed change targets a relationship
 * already linked to a systemic_confirmed issue (a citywide/architecture-wide
 * problem, not a one-off). Does not block; requires explicit human sign-off
 * (see the issue-tracking Skill). */
function checkSystemicCascade(world: WorldData, issues: ValidationIssue[]) {
  const confirmedSystemicSources = new Set(
    world.issues.issues
      .filter((i) => i.provenance === "systemic_confirmed" && i.sourceRelationshipId)
      .map((i) => i.sourceRelationshipId!),
  );
  for (const change of world.changes.changes) {
    if (confirmedSystemicSources.has(change.targetRelationshipId)) {
      issues.push({
        rule: "WARN_SYSTEMIC_CASCADE",
        subject: change.id,
        message: `Change '${change.id}' targets relationship '${change.targetRelationshipId}', already linked to a systemic_confirmed issue. Correcting it in isolation may just move the underlying problem — requires explicit human sign-off.`,
        severity: "warning",
      });
    }
  }
}

/** WARN_AFFINITY_UNRESOLVED — an issue is classified systemic_candidate
 * but no semantic affinity chain has been documented. */
function checkAffinityUnresolved(world: WorldData, issues: ValidationIssue[]) {
  for (const issue of world.issues.issues) {
    if (issue.provenance === "systemic_candidate" && issue.semanticAffinityChain.length === 0) {
      issues.push({
        rule: "WARN_AFFINITY_UNRESOLVED",
        subject: issue.id,
        message: `Issue '${issue.id}' is classified systemic_candidate but documents no semantic affinity chain.`,
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
  checkSystemicCascade(world, issues);
  checkAffinityUnresolved(world, issues);

  return {
    // Only ERR_* issues fail validation. WARN_* issues (systemic cascade,
    // affinity unresolved) are surfaced but do not block — they require a
    // human decision, not a code fix.
    valid: issues.every((i) => i.severity !== "error"),
    issues,
    checkedAt: new Date().toISOString(),
  };
}
