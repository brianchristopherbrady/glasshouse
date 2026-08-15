// Zod schemas describing the on-disk shape of world/*.json for THE FLOAT —
// Meridian's consensus-reality substrate, per prompt.md and 03-15_*.md.
// Kept loose (permissive optional fields) since this is a small,
// hand-authored fictional world, not a production data model.
import { z } from "zod";

// --- world/float.json --------------------------------------------------
// Every recognized relationship holding the Float together.

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

export const FloatSchema = z.object({
  relationships: z.array(RelationshipSchema),
});

// --- world/corrections.json ---------------------------------------------
// Every correction ever performed.

export const CorrectionOperationSchema = z.enum([
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

export const CorrectionSchema = z.object({
  id: z.string(),
  targetRelationshipId: z.string(),
  operation: CorrectionOperationSchema,
  authorizationId: z.string().optional(),
  performedBy: z.string().optional(),
  reconciliation: z.array(ReconciliationEntrySchema).default([]),
  protectedInvariants: z.array(z.string()).default([]),
  notes: z.string().optional(),
  timestamp: z.string().optional(),
});

export const CorrectionsFileSchema = z.object({
  corrections: z.array(CorrectionSchema),
});

// --- world/anomalies.json ------------------------------------------------

export const AnomalyProvenanceSchema = z.enum([
  "local_pressure",
  "correction_residue",
  "displaced_consequence",
  "bloomrot_candidate",
  "bloomrot_confirmed",
  "unresolvable",
  "unresolved",
]);

export const AnomalySchema = z.object({
  id: z.string(),
  description: z.string(),
  carrier: z.string().optional(),
  provenance: AnomalyProvenanceSchema,
  sourceRelationshipId: z.string().optional(),
  semanticAffinityChain: z.array(z.string()).default([]),
  status: z.enum(["open", "closed"]),
  closedBy: z.string().optional(),
  notes: z.string().optional(),
});

export const AnomaliesFileSchema = z.object({
  anomalies: z.array(AnomalySchema),
});

// --- world/characters.json ------------------------------------------------

export const CharacterProvenanceStatusSchema = z.enum(["closed", "open"]);

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  provenanceStatus: CharacterProvenanceStatusSchema,
  identityAnchorRelationshipId: z.string().optional(),
  notes: z.string().optional(),
});

export const CharactersFileSchema = z.object({
  characters: z.array(CharacterSchema),
});

// --- world/institutions.json ------------------------------------------------

export const InstitutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  correctionPermissions: z.array(CorrectionOperationSchema).default([]),
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
export type FloatFile = z.infer<typeof FloatSchema>;
export type CorrectionOperation = z.infer<typeof CorrectionOperationSchema>;
export type ReconciliationEntry = z.infer<typeof ReconciliationEntrySchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type CorrectionsFile = z.infer<typeof CorrectionsFileSchema>;
export type AnomalyProvenance = z.infer<typeof AnomalyProvenanceSchema>;
export type Anomaly = z.infer<typeof AnomalySchema>;
export type AnomaliesFile = z.infer<typeof AnomaliesFileSchema>;
export type CharacterProvenanceStatus = z.infer<typeof CharacterProvenanceStatusSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type CharactersFile = z.infer<typeof CharactersFileSchema>;
export type Institution = z.infer<typeof InstitutionSchema>;
export type InstitutionsFile = z.infer<typeof InstitutionsFileSchema>;

export interface WorldData {
  float: FloatFile;
  corrections: CorrectionsFile;
  anomalies: AnomaliesFile;
  characters: CharactersFile;
  institutions: InstitutionsFile;
}
