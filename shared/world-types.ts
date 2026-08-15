// Zod schemas describing the on-disk shape of world/*.json — a generic
// relational world model (structures, relationships, changes, issues,
// institutions) for tracking a system's structure and the changes made to
// it over time. This repo ships a "City Hall" example world (a municipal
// government managing a city, standing in for a team managing a codebase)
// to demonstrate the pattern -- a consuming repo should replace world/*.json's
// content with its own domain while keeping this shape.
// Kept loose (permissive optional fields) since this is a small,
// hand-authored example world, not a production data model.
import { z } from "zod";

// --- world/relationships.json -------------------------------------------
// Every recognized relationship between entities in the world.

export const RelationshipStatusSchema = z.enum([
  "active",
  "corrected",
  "severed",
  "redirected",
  "constrained",
  "unresolved",
]);

export const ProvenanceKindSchema = z.enum([
  "organic",
  "institutional",
  "corrected_into_existence",
  "unknown",
]);

export const RelationshipSchema = z.object({
  id: z.string(),
  subject: z.string(),
  object: z.string(),
  kind: z.string(),
  status: RelationshipStatusSchema,
  provenance: ProvenanceKindSchema,
  dependentRelationships: z.array(z.string()).default([]),
  displacedConsequences: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const RelationshipsFileSchema = z.object({
  relationships: z.array(RelationshipSchema),
});

// --- world/changes.json ---------------------------------------------
// Every change ever performed.

export const ChangeOperationSchema = z.enum([
  "sever",
  "attach",
  "reconcile",
  "redirect",
  "attenuate",
  "reinforce",
  "constrain",
  "partition",
  "bind",
  "substitute",
  "anchor",
  "isolate",
  "release",
]);

export const ReconciliationEntrySchema = z.object({
  relationshipId: z.string(),
  disposition: z.enum(["redirected", "transferred", "excluded", "displaced"]),
  justification: z.string().optional(),
});

export const ChangeSchema = z.object({
  id: z.string(),
  targetRelationshipId: z.string(),
  operation: ChangeOperationSchema,
  authorizationId: z.string().optional(),
  performedBy: z.string().optional(),
  reconciliation: z.array(ReconciliationEntrySchema).default([]),
  protectedInvariants: z.array(z.string()).default([]),
  notes: z.string().optional(),
  timestamp: z.string().optional(),
});

export const ChangesFileSchema = z.object({
  changes: z.array(ChangeSchema),
});

// --- world/issues.json ---------------------------------------------------
// Issues are the world's open task queue: unresolved problems, remaining
// work, and consequences of past actions that still need attention -- not
// unlike the downstream fixes a change in a codebase can leave behind.
// Logged and persisted by whichever institution has authority over that
// domain (`loggedBy`), and may be assigned to a different institution
// entirely to resolve (`assignedTo`) -- see the `issue-tracking` Skill.

export const IssueProvenanceSchema = z.enum([
  "local_pressure",
  "change_residue",
  "displaced_consequence",
  "systemic_candidate",
  "systemic_confirmed",
  "unresolvable",
  "unresolved",
]);

export const IssueSchema = z.object({
  id: z.string(),
  description: z.string(),
  affects: z.string().optional(),
  provenance: IssueProvenanceSchema,
  sourceRelationshipId: z.string().optional(),
  semanticAffinityChain: z.array(z.string()).default([]),
  status: z.enum(["open", "closed"]),
  loggedBy: z.string().optional(),
  assignedTo: z.string().optional(),
  closedBy: z.string().optional(),
  notes: z.string().optional(),
});

export const IssuesFileSchema = z.object({
  issues: z.array(IssueSchema),
});

// --- world/structures.json ------------------------------------------------

export const StructureProvenanceStatusSchema = z.enum(["closed", "open"]);

export const StructureSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  provenanceStatus: StructureProvenanceStatusSchema,
  identityAnchorRelationshipId: z.string().optional(),
  notes: z.string().optional(),
});

export const StructuresFileSchema = z.object({
  structures: z.array(StructureSchema),
});

// --- world/institutions.json ------------------------------------------------

export const InstitutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  changePermissions: z.array(ChangeOperationSchema).default([]),
  knownBiases: z.array(z.string()).default([]),
  authorizations: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const InstitutionsFileSchema = z.object({
  institutions: z.array(InstitutionSchema),
});

export type RelationshipStatus = z.infer<typeof RelationshipStatusSchema>;
export type ProvenanceKind = z.infer<typeof ProvenanceKindSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type RelationshipsFile = z.infer<typeof RelationshipsFileSchema>;
export type ChangeOperation = z.infer<typeof ChangeOperationSchema>;
export type ReconciliationEntry = z.infer<typeof ReconciliationEntrySchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type ChangesFile = z.infer<typeof ChangesFileSchema>;
export type IssueProvenance = z.infer<typeof IssueProvenanceSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type IssuesFile = z.infer<typeof IssuesFileSchema>;
export type StructureProvenanceStatus = z.infer<typeof StructureProvenanceStatusSchema>;
export type Structure = z.infer<typeof StructureSchema>;
export type StructuresFile = z.infer<typeof StructuresFileSchema>;
export type Institution = z.infer<typeof InstitutionSchema>;
export type InstitutionsFile = z.infer<typeof InstitutionsFileSchema>;

export interface WorldData {
  relationships: RelationshipsFile;
  changes: ChangesFile;
  issues: IssuesFile;
  structures: StructuresFile;
  institutions: InstitutionsFile;
}
