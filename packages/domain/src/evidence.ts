import { z } from 'zod';

/**
 * Confidence levels the product uses to describe how sure we are about a
 * fact. Never collapse these into a single boolean "true".
 */
export const ConfidenceSchema = z.enum(['observed', 'strong', 'inferred', 'unknown']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** Where a fact was learned from. */
export const EvidenceSourceSchema = z.enum([
  'github-actions',
  'github-api',
  'git',
  'runtime',
  'parser',
  'artifact',
  'inferred',
]);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const EvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  confidence: ConfidenceSchema,
  /** Optional free-text explanation of why this fact is believed. */
  note: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Skill usage is nuanced: a skill can be available/configured statically
 * while remaining unknown whether it was actually loaded or executed.
 * Never collapse these concepts into a single "used" boolean.
 */
export const SkillEvidenceStateSchema = z.enum([
  'available',
  'configured',
  'loaded',
  'referenced',
  'execution_evidence',
  'unknown',
]);
export type SkillEvidenceState = z.infer<typeof SkillEvidenceStateSchema>;
