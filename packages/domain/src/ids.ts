import { z } from 'zod';

/** Domain IDs are opaque strings, independent of provider IDs (GitHub, etc). */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

/**
 * A provider ID pairs a raw external identifier with the system it came
 * from. Domain entities keep provider IDs separate from their own IDs.
 */
export const ProviderIdSchema = z.object({
  provider: z.enum(['github']),
  id: z.string(),
});
export type ProviderId = z.infer<typeof ProviderIdSchema>;
