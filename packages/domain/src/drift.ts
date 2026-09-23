import { z } from 'zod';
import { IdSchema } from './ids.js';

/**
 * Expected-vs-observed comparison result ("Run Drift"). Language here must
 * stay neutral — this never asserts malicious intent, only difference.
 */
export const DriftKindSchema = z.enum([
  'unexpected_agent',
  'unexpected_skill',
  'unexpected_file',
  'missing_expected_step',
  'new_tool',
  'new_mcp_call',
  'new_permission',
  'different_output',
]);
export type DriftKind = z.infer<typeof DriftKindSchema>;

export const DriftFindingSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  kind: DriftKindSchema,
  description: z.string(),
  expected: z.string().optional(),
  observed: z.string().optional(),
});
export type DriftFinding = z.infer<typeof DriftFindingSchema>;
